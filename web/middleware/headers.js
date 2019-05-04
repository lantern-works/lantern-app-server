const util = require('../util')
const log = util.Logger

// ----------------------------------------------------------------------
module.exports = (req, res, next) => {
    try {
        if (req.headers.origin) {
            let origin = req.headers.origin.split('://')[1]
            let protocol = (req.secure ? 'https://' : 'http://')
            res.setHeader('Access-Control-Allow-Origin', '*')
        }
    } catch (e) {
        log.error(e)
    }

    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.header('Access-Control-Allow-Headers', 'accept, authorization, x-requested-with, x-http-method-override, content-type, origin, referer, x-csrf-token')
    res.header('Access-Control-Allow-Credentials', true)

    // allow service worker to access all files
    res.header('Service-Worker-Allowed', '/')

    // intercepts OPTIONS method
    if (req.method === 'OPTIONS') {
        // respond with 200
        res.status(200).send()
    } else {
        res.header('X-Lantern-Cloud', res.app.locals.cloud)
        res.header('X-Lantern-Online', res.app.locals.online)
        res.header('X-Lantern-Peer', res.app.locals.peer)
        next()
    }
}
