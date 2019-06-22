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
fs.ensureDirSync(path.resolve(__dirname, './tiles'))

// ----------------------------------------------------------------------

const http = require('http')
const https = require('https')
const util = require('./util')
const app = require('./server')
const watch = require('./watcher')
const conf = require('./config')
const log = util.Logger
const setupDatabase = require('./db')

log.setLevel(process.env.LOG_LEVEL || 'debug')
log.info('##############################################')
log.info('#    ')
log.info('#    Lantern App Server ' + conf.peer + ' [ prime = ' + conf.prime + ' ]')
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
            let privateKeyPath = process.env.SSL_PRIVATE_KEY || path.resolve(__dirname, './certs/dev/dev.lantern.link-key.pem')
            let certificatePath = process.env.SSL_CERTIFICATE || path.resolve(__dirname, './certs/dev/dev.lantern.link.pem')

            log.info(`${util.logPrefix('web')} private key = ${privateKeyPath}`)
            log.info(`${util.logPrefix('web')} cert = ${certificatePath}`)

            let credentials = {
                key: fs.readFileSync(privateKeyPath, 'utf8'),
                cert: fs.readFileSync(certificatePath, 'utf8'),
                rejectUnauthorized: false
            }

            // allow support for multiple certificate authority files
            // https://stackoverflow.com/questions/19104215/node-js-express-js-chain-certificate-not-working
            if (process.env.hasOwnProperty('SSL_CA')) {
               credentials.ca = process.env.SSL_CA.split(',').map(x => fs.readFileSync(x, 'utf8'))
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
                setAppLocals()
                // re-check for internet access every 30 seconds
                setInterval(checkOnlineStatus, 30000)
                resolve(secureServer || stdServer)
            })
        })
    })
}

const setAppLocals = () => {
    app.locals.peer = conf.peer
    app.locals.prime = conf.prime
    // track inbox messags
    app.locals.inbox = []
    // track outbox messages
    app.locals.outbox = []
    checkOnlineStatus()
}

const checkOnlineStatus = () => {
    // get sense of what sort of device we have here
    util.checkInternet().then(status => {
        app.locals.online = status ? '1' : '0'
        app.locals.cloud = process.env.CLOUD === 'true' ? '1' : '0'
    })
}

// ----------------------------------------------------------------------------

// restores an existing database or backs up existing one
startServer()
    .then((server) => {
        return setupDatabase(server, app)
    })
    .then(() => {
        watch(app)
    })
    .catch((e) => {
        log.error('Failed to start server:')
        log.error(e)
    })
