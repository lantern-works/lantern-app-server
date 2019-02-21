/**
* Lantern Utilities
*
*/
const path = require('path')
const fs = require('fs-extra')
const browserify = require('browserify')
const minify = require('@node-minify/core')
const uglifyJS = require('@node-minify/uglify-es')
const concat = require('concat')
const self = {}

// ----------------------------------------------------------------------
self.removeMeta = function (obj) {
    for (var prop in obj) {
        if (prop === 'path') {
            delete obj[prop]
        } else if (typeof obj[prop] === 'object') {
            this.removeMeta(obj[prop])
        }
    }
}

// ----------------------------------------------------------------------
/**
* Log facility
*/
self.Logger = require('simple-node-logger').createSimpleLogger({
    logFilePath: path.resolve(__dirname, '../logs', 'http.log'),
    dateFormat: 'YYYY.MM.DD'
})

self.logPrefix = (val) => {
    return `[${val}]`.padEnd(10, ' ')
}

/**
* Get HTTP Non-Secure Port
*/
self.getHttpPort = () => {
    return (process.env.TERM_PROGRAM ? 9080 : 80)
}

/**
* Get HTTPS Secure Port
*/
self.getHttpsPort = () => {
    return (process.env.TERM_PROGRAM ? 9443 : 443)
}

/**
* Intended / common domain used even while offline
*/
self.getDomain = () => {
    return 'lantern.link'
}

/**
* Check for internet access
*/
self.checkInternet = () => {
    return new Promise((resolve, reject) => {
        require('dns').lookup('google.com', (err, res) => {
            if (err && err.code === 'ENOTFOUND') {
                resolve(false)
            } else if (res.substr(0, 4) === '192.') {
                // local IP from router
                resolve(false)
            } else {
                resolve(true)
            }
        })
    })
}

/**
* Extract IP address from request object
*/
self.getClientIP = (req) => {
    return req.headers['x-forwarded-for'] || req.connection.remoteAddress
}

/**
* Check if this is a remote client requesting a resource
*/
self.isRemoteClient = (req) => {
    let ip = self.getClientIP(req)
    return ip && (ip.indexOf('127.0.0.1') === -1)
}

// ----------------------------------------------------------------------
/**
* Simplifies message by removing sequence, useful for comparisons
*/
self.getSimpleMessage = (msg) => {
    return msg.replace(/^([0-9]+)([\^\+\-])/, '')
}

// ----------------------------------------------------------------------
/**
* Minify styles
*/
self.compressAllStylesheets = () => {
    return new Promise((resolve, reject) => {
        let files = [
            'node_modules/bulma/css/bulma.min.css',
            'node_modules/leaflet/dist/leaflet.css',
            'node_modules/leaflet.locatecontrol/dist/L.Control.Locate.min.css',
            'node_modules/@fortawesome/fontawesome-free/css/all.min.css',
            'node_modules/typeface-montserrat/index.css'
        ]

        let vendorCSS = path.resolve(__dirname, './public/styles/vendor.css')

        concat(files, vendorCSS)
        resolve()
    })
}

/**
* Pack scripts
*/
self.packAllJavascript = () => {
    return Promise.all([self.packJavascript('data', 'LD'), self.packJavascript('apps', 'LA'), self.packJavascript('maps', 'LM')])
}

self.packJavascript = (name, scope) => {
    return new Promise((resolve, reject) => {
        let platformScript = path.resolve(__dirname, `./public/scripts/${name}.js`)
        let b = browserify([`platform/${name}.js`], {
            'standalone': scope
        })
        let writeStream = fs.createWriteStream(platformScript)
        b.bundle()
            .pipe(writeStream)
            .on('finish', () => {
                resolve()
            })
            .on('error', (e) => {
                reject(e)
            })
    })
}

/**
* Minify scripts
*/
self.compressAllJavascript = () => {
    return Promise.all([self.compressJavascript('maps'), self.compressJavascript('apps'), self.compressJavascript('data')])
}

self.compressJavascript = (name) => {
    return new Promise((resolve, reject) => {
        // handle minification directly here rather than build scripts
        let platformMin = path.resolve(__dirname, `./public/scripts/${name}.min.js`)

        // offer compressed versions of scripts
        minify({
            compressor: uglifyJS,
            input: path.resolve(__dirname, `./public/scripts/${name}.js`),
            output: platformMin,
            callback: resolve
        })
    })
}

// ----------------------------------------------------------------------
/**
* Display memory usage over time
*/
self.watchMemory = () => {
    setInterval(() => {
        self.Logger.debug('---')
        let arr = [1, 2, 3, 4, 5, 6, 9, 7, 8, 9, 10]
        arr.reverse()
        let used = process.memoryUsage()
        for (const key in used) {
            self.Logger.debug(key + ' ' + Math.round(used[key] / 1024 / 1024 * 100) / 100 + ' MB')
        }
        self.Logger.debug('---')
    }, 60 * 1000 * 2)
}

module.exports = self
