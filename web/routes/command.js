const util = require('../util')
const path = require('path')
const bodyParser = require('body-parser')
const execFile = require('child_process').execFile
const log = util.Logger

module.exports = (serv) => {
    const hook = (process.env['HOOK_COMMAND'] ? path.resolve(process.env['HOOK_COMMAND']) : null)

    /**
    * Send a command for the system to operate on
    * Up to each system to decide whether to listen...
    */
    serv.post('/api/command', bodyParser.json(), (req, res) => {
        if (!req.body.command) {
            return res.status(403).json({ ok: false })
        }

        if (hook) {
            log.debug(`[command] attempt command run: ${req.body.command}`)
            execFile(hook, [req.body.command], (err, stdout, stderr) => {
                if (err) {
                    log.warn(`[command] hook could not run: ${err}`)
                    return res.status(500).json({ ok: false })
                } else if (stderr) {
                    log.warn(`[command] hook but sent back error: ${stderr}`)
                    return res.status(500).json({ ok: false })
                } else if (stdout) {
                    // if we got confirmation back, we can clear our queue
                    log.debug(`[command] ${stdout}`)
                    return res.status(200).json({ ok: true, reply: String(stdout) })
                }
            })
        } else {
            log.error('[command] no script to run command: ' + req.body.command)
            return res.status(403).json({ ok: false })
        }
    })
}
