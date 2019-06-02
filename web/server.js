/**
* Lantern Routes
*
* Our routes make heavy use of install node modules where possible
* to avoid duplication of code and ensure easy maintenance
*
**/
const express = require('express')
const GraphDB = require('gun')
const fs = require('fs-extra')
const path = require('path')
const helmet = require('helmet')
const compression = require('compression')
const util = require('./util')
const log = util.Logger
log.setLevel('debug')
const server = express()

// ----------------------------------------------------------------------------
server.disable('x-powered-by')
server.use(compression())
server.use((req,res,next) => {
    const notRoute = (route) => {
        return req.url.indexOf(route) === -1
    }
    if (notRoute('/styles') 
        && notRoute('/webfonts') 
        && notRoute('/api/tiles')
        && notRoute('/scripts') 
        && notRoute('/favicon.ico')
    ) {
        log.info(`[request] ${req.url}`)
    }
    next()
})


if (process.env.hasOwnProperty('LORA_TEST')) {
    log.debug("[web] LoRa Test Activated")
    server.get('/', (req,res) => {
        return res.sendFile(staticPath + '/test/lora.html')
    })
}



const staticPath = path.resolve(__dirname, './public/')
server.use(express.static(staticPath))

// ------------------------------------------------------------------------- Fills
const dir = path.resolve(__dirname, '../node_modules')
const modulesPath = path.resolve(dir + '/@fortawesome/fontawesome-free/webfonts')
server.use('/webfonts/', express.static(modulesPath))
server.get('/styles/L.Control.Locate.min.css.map', (req, res) => {
    res.sendFile(dir + '/leaflet.locatecontrol/dist/L.Control.Locate.min.css.map')
})

server.get('/styles/files/:filename', (req, res) => {
    res.sendFile(dir + '/typeface-montserrat/files/' + req.params.filename)
})

// ------------------------------------------------------------------------- Static
server.use(helmet.noCache())
server.use(require('./middleware/captive'))

// final routes are for any static pages and binary files
server.get('/@/', (req, res) => {
    return res.sendFile(staticPath + '/portal/index.html')
})

// ------------------------------------------------------------------------- Routes
const routeFiles = fs.readdirSync(path.resolve(__dirname, './routes'))
routeFiles.forEach((file) => {
    log.debug('[route] ' + file)
    require('./routes/' + file)(server)
})

// layers for custom app functionality
const appsPath = path.resolve(__dirname, '..', 'apps')
server.use('/-/', express.static(appsPath))

// ------------------------------------------------------------------------- Database
server.use(GraphDB.serve)

module.exports = server
