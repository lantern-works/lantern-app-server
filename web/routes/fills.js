/**
* Fill Routes
*
* Ensure no expected routes are missing
**/
const express = require('express')
const path = require('path')

module.exports = (serv) => {
    const dir = path.resolve(__dirname, '../../node_modules')

    serv.get('/styles/L.Control.Locate.min.css.map', (req, res) => {
        res.sendFile(dir + '/leaflet.locatecontrol/dist/L.Control.Locate.min.css.map')
    })

    serv.get('/styles/files/:filename', (req, res) => {
        res.sendFile(dir + '/typeface-montserrat/files/' + req.params.filename)
    })

    const modulesPath = path.resolve(dir + '/@fortawesome/fontawesome-free/webfonts')
    serv.use('/webfonts/', express.static(modulesPath))
}
