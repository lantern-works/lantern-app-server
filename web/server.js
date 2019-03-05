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
const server = express()

// ----------------------------------------------------------------------------
server.disable('x-powered-by')
server.use(helmet.noCache())
server.use(compression())
server.use(require('./middleware/captive'))
server.use(require('./middleware/headers'))
server.use(require('./middleware/secure'))

// final routes are for any static pages and binary files
const staticPath = path.resolve(__dirname, './public/')
server.get('/@/', (req, res) => {
    res.sendFile(staticPath + '/captive.html')
})
server.use('/', express.static(staticPath))

// auto-load routes
const routeFiles = fs.readdirSync(path.resolve(__dirname, './routes'))
routeFiles.forEach((file) => {
    log.debug('[route] ' + file)
    require('./routes/' + file)(server)
})

// layers for custom app functionality
const appsPath = path.resolve(__dirname, '..', 'apps')
server.use('/-/', express.static(appsPath))

server.use(GraphDB.serve)

module.exports = server
