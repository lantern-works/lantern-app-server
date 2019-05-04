const accepted = {}
const util = require('../util')
const log = util.Logger

// ----------------------------------------------------------------------
module.exports = (req, res, next) => {
    // only work with captive portal requests on the local device
    if (process.env.CLOUD === 'true') {
        return next()
    } else if (req.url.indexOf('.html') == -1) {
        return next()
    }

    let ip = util.getClientIP(req)

    const isClientConnected = () => {
        return accepted.hasOwnProperty(ip) && accepted[ip]
    }

    const markClientConnected = () => {
        log.info('[captive] mark client ' + ip + ' connected')
        accepted[ip] = new Date()
    }

    const removeClient = () => {
        accepted[ip] = false
    }

    const isCaptiveNetworkSupport = () => {
        return (req.get('User-Agent') && req.get('User-Agent').indexOf('CaptiveNetworkSupport') !== -1)
    }

    const sendSuccessMessage = () => {
        return res.status(204).send('SUCCESS')
    }
    const sendOfflineMessage = () => {
        return res.status(200).send('NO SUCCESS')
    }

    // ------------------------------------------------------------------

    // ignore internal requests from device itself
    if (!util.isRemoteClient(req)) {
        return next()
    } else if (req.url === '/logout') {
        removeClient()
        res.status(200).send('Successfully Logged Out of Captive Portal')
    } else if (req.url === '/success.txt') {
        // mozilla checks for working network
        log.debug('[captive] mozilla captive portal check')
        res.status(200).send('success\n')
    } else if (req.url === '/generate_204') {
        log.debug('[captive] google captive portal check')
        sendSuccessMessage()
    }
    // check for captive portal logic
    else if (isCaptiveNetworkSupport()) {
        if (req.url === '/hotspot-detect.html') {
            if (isClientConnected()) {
                log.debug('[captive] apple captive portal success')
                res.send('<HTML><HEAD><TITLE>Success</TITLE></HEAD><BODY>Success</BODY></HTML>')
            } else {
                log.debug('[captive] apple captive portal check')
                sendOfflineMessage()
            }
        } else {
            log.error('[captive] unexpected request: ' + req.url)
        }
    } else {
        if (req.url === '/hotspot-detect.html') {
            log.debug('[captive] apple serve sign-in page for captive portal')
            // automatically sign-in user on page load
            // next request (typically from within standard device browser) should pass through fine
            markClientConnected()
            res.redirect(`https://${util.getDomain()}/@/`)
        } else {
            return next()
        }
    }
}
