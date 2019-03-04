/**
* Lantern App Server
*
* We serve web logic with Express and the database at the same origin.
* This allows easy access to the database through javascript.
* Useful for hosting on a Raspberry Pi or cloud environment.
*
**/
const fs = require('fs-extra')
const path = require('path')
fs.ensureDirSync(path.resolve(__dirname, '../logs'))
fs.ensureDirSync(path.resolve(__dirname, '../db'))
fs.ensureDirSync(path.resolve(__dirname, './public/tiles'))

// ----------------------------------------------------------------------

const http = require('http')
const https = require('https')
const util = require('./util')
const app = require('./server')
const watch = require('./watcher')
const backup = require('./backup')
const log = util.Logger
log.setLevel(process.env.LOG_LEVEL || 'debug')
log.info('##############################################')
log.info('#    ')
log.info('#    Lantern App Server')
log.info('#    ')
log.info('##############################################')

// ----------------------------------------------------------------------
/**
* Start HTTP Server
*/
const startServer = () => {
    return new Promise((resolve, reject) => {
        let secureServer = null
        try {
            // read in ssl certificate data
            let privateKeyPath = process.env.SSL_PRIVATE_KEY || path.resolve(__dirname, './certs/dev.lantern.link-key.pem')
            let certificatePath = process.env.SSL_CERTIFICATE || path.resolve(__dirname, './certs/dev.lantern.link.pem')
            let credentials = {
                key: fs.readFileSync(privateKeyPath, 'utf8'),
                cert: fs.readFileSync(certificatePath, 'utf8')
            }
            secureServer = https.createServer(credentials, app)
        } catch (e) {
            if (e.code === 'ENOENT') {
                log.error(`SSL certificates not found in "certs" directory...`)
            } else {
                log.error(e)
            }
            reject(e)
        }
        // start the web server with built-in database solution
        let httpServer = http.createServer(app)
        secureServer.listen(util.getHttpsPort(), () => {
            let stdServer = httpServer.listen(util.getHttpPort(), () => {
                log.info(`${util.logPrefix('web')} standard port = ${util.getHttpPort()}`)
                if (secureServer) {
                    log.info(`${util.logPrefix('web')} secure port = ${util.getHttpsPort()}`)
                } else {
                    log.warn(`${util.logPrefix('web')} falling back to http for local development...`)
                }

                // track inbox messags
                app.locals.inbox = []
                // track outbox messages
                app.locals.outbox = []
                checkOnlineStatus()
                resolve(secureServer || stdServer)
                // re-check for internet access every five seconds
                setInterval(checkOnlineStatus, 5000)
            })
        })
    })
}

const checkOnlineStatus = () => {
    // get sense of what sort of device we have here
    util.checkInternet().then(status => {
        app.locals.online = status ? '1' : '0'
        app.locals.cloud = process.env.CLOUD === 'true' ? '1' : '0'
    })
}

/**
* Create or use existing database
*/
const setupDatabase = (server) => {
    // log.debug(`${util.logPrefix('db')} path = ${dbPath}`)

    // run a backup of data every day

    let db = require('gun')({
        file: dbPath,
        web: server
    })

    // attach database instance as a local app variable for express routes
    app.locals.db = db

    return Promise.resolve(dbPath)
}

// ----------------------------------------------------------------------------

// choose database location
let dbPath = path.resolve(__dirname, '../db/dev')
if (process.env.DB) {
    dbPath = path.resolve(__dirname, '../' + process.env.DB)
}

// restores an existing database or backs up existing one
backup(dbPath)
    .then(startServer)
    .then(setupDatabase)
    .then((dbPath) => {
        return new Promise((resolve, reject) => {
            // starts watching for changes
            watch(app)
            setTimeout(resolve, 1000)
        })
    })
    .then(() => {
        // make sure we always compile latest assets in cloud
        // local machines will typically have scripts already generated
        // and we may want to avoid long load times
        if (process.env.CLOUD) {
            util.packAllJavascript()
                .then(util.compressAllStylesheets)
                .then(util.compressAllJavascript)
                .then(() => {
                    // the above methods are useful to make sure any code updates since last start
                    // are fully considered when user makes a request via the browser
                    log.info(`${util.logPrefix('web')} platform code rebuilt`)
                })
        }
    })
    .catch((e) => {
        log.error('Failed to start server:')
        log.error(e)
    })
