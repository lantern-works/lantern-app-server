const util = require('../util')
const log = util.Logger
module.exports = (serv) => {
    /**
    * Update to latest version of platform code
    */
    serv.post('/api/platform', (req, res) => {
        // also re-generate scripts so we're always working with the most up-to-date
        util.packAllJavascript()
            .then(util.compressAllStylesheets)
            .then(util.compressAllJavascript)
            .then(() => {
                res.status(201).json({ 'ok': true })
                log.info(`${util.logPrefix('platform')} javascript and stylesheets recompiled...`)
            })
            .catch((e) => {
                log.error(e)
                res.status(500).json({ 'ok': false })
            })
    })
}
