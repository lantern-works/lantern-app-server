/**
* Map Routes
*
* Proxies MapTiler requests and caches offline for reliable access
**/
const fs = require('fs-extra')
const path = require('path')
const request = require('request')
const util = require('../util')
const log = util.Logger

// ----------------------------------------------------------------------
module.exports = (serv) => {
    let tilesDir = path.resolve(__dirname, '../public/tiles')
    let assumeInternet = true

    // offer these routes a chance to bypass attempts at internet
    util.checkInternet().then((isConnected) => {
        assumeInternet = isConnected
    })

    /**
    * Convert URL to local file path for cached tile
    */
    const getLocalPathForTile = (params) => {
        let zxy = `${tilesDir}/${params.z}_${params.x}_${params.y}.png`
        return zxy
    }

    /**
    * Use special empty tile to notify user that a tile request was forbidden or failed
    */
    const sendEmptyTile = (res) => {
        let assetsDir = path.resolve(__dirname, '../public/assets/')
        let filePath = assetsDir + '/empty-tile.png'
        fs.readFile(filePath, (err, buffer) => {
            if (err) {
                return log.error('Could not read empty tile file')
            }
            res.type('png')
            res.send(buffer)
        })
    }

    /**
    * Use MapTiler service to proxy and save tiles to local storage
    */
    const getTileFromCloud = (req, res) => {
        let preq = request('http://maps.tilehosting.com' + req.url)

        // return result as quickly as possible to browser
        let result = preq
            .on('response', (pres) => {
                // log.debug("Streamed tile from cloud: " + req.url);

                // also stream to file system for cache
                preq.pipe(fs.createWriteStream(getLocalPathForTile(req.params)))
                    .on('error', (err) => {
                        log.error('Could not save tile for: ' + req.url)
                        log.error(err)
                    })
            })
            .on('error', (err) => {
                log.error('Could not stream tile for: ' + req.url)
                log.error(err)
                if (res) {
                    sendEmptyTile(res)
                }
            })

        if (res) {
            result.pipe(res)
        }
    }

    // ----------------------------------------------------------------------


    /**
    * Tile Proxy
    */
    serv.get('/c/:id/styles/:map/:z/:x/:y.png', (req, res, next) => {
        // use offline cache if available, avoids hitting external sever
        let tileFile = getLocalPathForTile(req.params)
        res.type('png')
        let tileStream = fs.createReadStream(tileFile)
            .on('error', (err) => {
                if (!assumeInternet) {
                    // log.debug(`Skip offline attempt for: ${req.url}`);
                    return sendEmptyTile(res)
                } else {
                    getTileFromCloud(req, res)
                }
            })

        tileStream.pipe(res)
    })

     /**
    * Tile Cache
    */
    serv.get('/c/:id/styles/:map/:z/:x/:y.json', (req, res, next) => {
        // use offline cache if available, avoids hitting external sever
        let tileFile = getLocalPathForTile(req.params)
        if (!fs.existsSync(tileFile)) {
            if (!assumeInternet) {
                return res.status(403).json({"ok": false})
            } else {
                getTileFromCloud(req)
                res.status(201).json({"ok": true})
            }
        }
        else {
            res.status(200).json({"ok": true})
        }
    })
}
