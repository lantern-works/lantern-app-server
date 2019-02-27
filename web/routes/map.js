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
/** 
* Converts numeric degrees to radians 
*/
if (typeof(Number.prototype.toRad) === "undefined") {
  Number.prototype.toRad = function() {
    return this * Math.PI / 180;
  }
}



// ----------------------------------------------------------------------
module.exports = (serv) => {
    const tileUri = '/styles/:map/:z/:x/:y.png'
    const minZoom = 3
    const maxZoom = 17
    let tilesDir = path.resolve(__dirname, '../public/tiles')
    let assetsDir = path.resolve(__dirname, '../public/assets/')
    let assumeInternet = true

    // offer these routes a chance to bypass attempts at internet
    util.checkInternet().then((isConnected) => {
        assumeInternet = isConnected
    })

    // prepare empty tile
    let emptyTileFilePath = assetsDir + '/empty-tile.png'
    let emptyTileBuffer = fs.readFileSync(emptyTileFilePath)

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
        res.type('png')
        res.send(emptyTileBuffer)
    }

    /**
    * Convert lat/long/zoom into xyz coordinates for map tiles
    */
    const getXYZ = (lat, lng, zoom) => {
        var xtile = parseInt(Math.floor( (lng + 180) / 360 * (1<<zoom) ));
        var ytile = parseInt(Math.floor( (1 - Math.log(Math.tan(lat.toRad()) + 1 / Math.cos(lat.toRad())) / Math.PI) / 2 * (1<<zoom) ));
        return {x: xtile, y: ytile, z: zoom};
    }

    const cacheManyTiles = (params, key,  i) => {
        let lat = Number(params.lat)
        let lng = Number(params.lng)

        // start y
        let xyz =  getXYZ(lat, lng, i)
        cacheTile(xyz, params, key)

        // up y
        setTimeout(() => {
            let up = JSON.parse(JSON.stringify(xyz))
            up.y += 1
            cacheTile(up, params, key)
        }, 250)

        // down y
        setTimeout(() => {
            let down = JSON.parse(JSON.stringify(xyz))
            down.y -= 1
            cacheTile(down, params, key)
        }, 500)
    }

    /**
    * Cache tile for a given leaflet-style URI
    */
    const cacheTile = (xyz, params, key) => {
        params = Object.assign(xyz, params)
        let tileFile = getLocalPathForTile(params)
        // use offline cache if available, avoids hitting external sever
        if (!assumeInternet || fs.existsSync(tileFile)) {
            return
        }
 
        let url = tileUri
            .replace(':x', params.x)
            .replace(':y', params.y)
            .replace(':z', params.z)
            .replace(':map', params.map) + '?key=' + key
        getTileFromCloud(url, params)
    }


    /**
    * Use MapTiler service to proxy and save tiles to local storage
    */
    const getTileFromCloud = (url, params, res) => {
        let streamUrl = 'http://maps.tilehosting.com' + url
        let preq = request(streamUrl, {
            timeout: 1200
        })

        // return result as quickly as possible to browser
        let result = preq
            .on('response', (pres) => {
                // log.debug("[map] stream tile from cloud: " + url);
                let contentType = pres.headers['content-type']

                if (contentType != 'image/png') {
                    log.error('[map] non-image for tile: ' + streamUrl)
                    if (res) {
                        sendEmptyTile(res)
                    }
                    return
                }

                // also stream to file system for cache
                preq.pipe(fs.createWriteStream(getLocalPathForTile(params)))
                    .on('error', (err) => {
                        log.error('[map] no save for tile: ' + url)
                        log.error(err)  
                    })
            })
            .on('error', (err) => {
                if (err.code == "ESOCKETTIMEDOUT") {
                    log.error('[map] timeout trying tile: ' + url)
                } else {
                    //log.error('[map] no stream for tile: ' + streamUrl)
                    //log.error(err)
                }

                if (res) {
                    sendEmptyTile(res)
                }
            })

        if (res) {
            result.pipe(res)
        }
    }

    /**
    * Tile Proxy
    */
    serv.get(tileUri, (req, res, next) => {
        // use offline cache if available, avoids hitting external sever
        let tileFile = getLocalPathForTile(req.params)
        res.type('png')
        let tileStream = fs.createReadStream(tileFile)
            .on('error', (err) => {
                if (!assumeInternet) {
                    // log.debug(`Skip offline attempt for: ${req.url}`);
                    return sendEmptyTile(res)
                } else {
                    getTileFromCloud(req.url, req.params, res)
                }
            })

        tileStream.pipe(res)
    })

     /**
    * Tile Cache
    */
    serv.put('/api/map/:map/:lat/:lng/:zoom.json', (req, res) => {
        for (var i= minZoom; i < maxZoom;  i++) {
            setTimeout(() => {
                cacheManyTiles(req.params, req.query.key, i)  
            }, i*(100+Math.random(1000)))
        }
        res.status(200).json({"ok": true})
    })
}
