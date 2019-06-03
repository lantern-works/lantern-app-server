/**
* Map Routes
*
* Proxies MapTiler requests and caches offline for reliable access
**/
const fs = require('fs-extra')
const path = require('path')
const request = require('request')
const util = require('../util')
const headers = require('../middleware/headers')
const log = util.Logger

// ----------------------------------------------------------------------
/**
* Converts numeric degrees to radians
*/
if (typeof (Number.prototype.toRad) === 'undefined') {
    Number.prototype.toRad = function () {
        return this * Math.PI / 180
    }
}

// ----------------------------------------------------------------------
module.exports = (serv) => {
    const tileUri = '/styles/:map/:z/:x/:y.png'
    const minZoom = 3
    const maxZoom = 17
    const tilesDir = path.resolve(__dirname, '../tiles')
    const assetsDir = path.resolve(__dirname, '../public/assets/')

    let cachedTiles = {}
    let assumeInternet = true

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
        return res.send(emptyTileBuffer)
    }

    /**
    * Convert lat/long/zoom into xyz coordinates for map tiles
    */
    const getXYZ = (lat, lng, zoom) => {
        var xtile = parseInt(Math.floor((lng + 180) / 360 * (1 << zoom)))
        var ytile = parseInt(Math.floor((1 - Math.log(Math.tan(lat.toRad()) + 1 / Math.cos(lat.toRad())) / Math.PI) / 2 * (1 << zoom)))
        return { x: xtile, y: ytile, z: zoom }
    }

    const cacheManyTiles = (params, key, i) => {
        let lat = Number(params.lat)
        let lng = Number(params.lng)
        let delay = i * (750 + Math.random(2000))

        // log.debug("[tiles] caching tiles", params,  i)
        setTimeout(() => {
            let xyz = getXYZ(lat, lng, i)
            cacheTile(xyz, params, key)

            // up
            setTimeout(() => {
                let up = JSON.parse(JSON.stringify(xyz))
                up.y += 1
                cacheTile(up, params, key)
            }, 250)

            setTimeout(() => {
                let up = JSON.parse(JSON.stringify(xyz))
                up.x += 1
                cacheTile(up, params, key)
            }, 500)

            setTimeout(() => {
                let up = JSON.parse(JSON.stringify(xyz))
                up.y += 2
                cacheTile(up, params, key)
            }, 750)

            // down
            setTimeout(() => {
                let down = JSON.parse(JSON.stringify(xyz))
                down.y -= 1
                cacheTile(down, params, key)
            }, 1000)

            setTimeout(() => {
                let down = JSON.parse(JSON.stringify(xyz))
                down.x -= 1
                cacheTile(down, params, key)
            }, 1250)

            setTimeout(() => {
                let down = JSON.parse(JSON.stringify(xyz))
                down.y -= 2
                cacheTile(down, params, key)
            }, 1500)
        }, delay)
    }

    /**
    * Cache tile for a given leaflet-style URI
    */
    const cacheTile = (xyz, params, key) => {
        params = Object.assign(xyz, params)
        let tileFile = getLocalPathForTile(params)

        let url = tileUri
            .replace(':x', params.x)
            .replace(':y', params.y)
            .replace(':z', params.z)
            .replace(':map', params.map) + '?key=' + key

        // use offline cache if available, avoids hitting external sever
        if (!assumeInternet || fs.existsSync(tileFile)) {
            return
        }
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

        let useEmptyTile = false

        // return result as quickly as possible to browser
        let result = preq
            .on('response', (pres) => {
                // log.debug("[tiles] stream tile from cloud: " + url);
                let contentType = pres.headers['content-type']

                if (contentType != 'image/png') {
                    log.warn('[tiles] non-image for tile: ' + streamUrl)
                    useEmptyTile = true
                    return
                }

                // also stream to file system for cache
                preq.pipe(fs.createWriteStream(getLocalPathForTile(params)))
                    .on('error', (err) => {
                        if (err.errno === 'ENOTFOUND') {
                            log.warn('[tiles] could not find online: ' + url)
                        } else {
                            log.warn('[tiles] no save for tile: ' + url)
                            log.warn(err)
                        }
                    })
            })
            .on('error', (err) => {
                if (err.code == 'ESOCKETTIMEDOUT') {
                    log.warn('[tiles] timeout trying tile: ' + url)
                } else {
                    log.warn('[tiles] no stream for tile: ' + streamUrl)
                    log.warn(err)
                }
                useEmptyTile = true
            })

        if (res) {
            if (useEmptyTile) {
                sendEmptyFile(res)
            } else {
                result.pipe(res)
            }
        }
    }

    /**
    * Tile Proxy
    */
    serv.get(tileUri, headers, (req, res, next) => {
        // use offline cache if available, avoids hitting external sever
        assumeInternet = res.app.locals.online == '1'
        let tileFile = getLocalPathForTile(req.params)
        res.type('png')

        if (cachedTiles[req.url]) {
            // log.debug('[tiles] using ram cache for ' + req.url)
            return res.send(cachedTiles[req.url])
        } else {
            let chunks = []

            tileStream = fs.createReadStream(tileFile)

            tileStream.on('data', (chunk) => {
                res.write(chunk)
                chunks.push(chunk)
            })

            tileStream.on('end', () => {
                let result = Buffer.concat(chunks)
                // log.debug('[tiles] cache ' + req.url + result.length)
                cachedTiles[req.url] = result
                return res.end()
            })

            tileStream.on('error', (err) => {
                if (!assumeInternet) {
                    // log.debug(`skip offline attempt for: ${req.url}`);
                    return sendEmptyTile(res)
                } else {
                    getTileFromCloud(req.url, req.params, res)
                }
            })
        }
    })

    /**
    * Tile Cache
    */
    serv.get('/api/tiles/:map/:lat/:lng.json', headers, (req, res) => {
        assumeInternet = res.app.locals.online == '1'
        for (var i = minZoom; i <= maxZoom; i++) {
            cacheManyTiles(req.params, req.query.key, i)
        }
        return res.status(200).json({ 'ok': true })
    })
}
