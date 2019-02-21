const util = require('../util')

// ----------------------------------------------------------------------
module.exports = (req, res, next) => {
    // https redirect
    if (req.secure) {
        // OK, continue
        return next()
    };

    if (req.url.indexOf('/c/') !== -1) {
        return next()
    }

    // handle port numbers if you need non defaults
    let uri = 'https://' + req.hostname
    let port = util.getHttpsPort()
    if (port !== 443) {
        uri += ':' + port
    }
    uri += req.url
    res.redirect(uri)
}
