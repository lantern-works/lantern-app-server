/**
* Outbox Routes
*
* API to manage messages to be sent over long-range radio
**/
const conf = require('../config')
const util = require('../util')
const log = util.Logger
const bodyParser = require('body-parser')

// @todo add LZMA compression as optional
module.exports = (serv) => {
    const updateRegex = /([A-Za-z0-9\-\_]+)\>\>([A-Za-z\-]+)\@([0-9\.]+)\:\:([0-9]+)\:\:([0-9]+)\|(.*)/
    const queryRegex = /([A-Za-z0-9\-\_]+)\>\>([A-Za-z\-]+)\@([0-9\.]+)\:\:([0-9]+)\:\:([0-9]+)/

    
    // ----------------------------------------------------------------------
    /**
    * List outbox messages queued for forward
    */
    serv.get('/api/outbox', (req, res) => {
        return res.status(200).json({
            'messages': res.app.locals.outbox
        })
    })
    
    /**
    * Queue messages to forward to nearby devices
    */
    serv.put('/api/outbox', bodyParser.json(), (req, res) => {
        let box = res.app.locals.outbox
        let previousMessage = box[box.length - 1]

        let msg = req.body.message
        if (!msg) {
            log.debug(`${util.logPrefix('outbox')} ignore empty message`)
            return res.status(403).json({ 'ok': false })
        }

        // attach device identifier to message
        msg = conf.peer + '>>' + msg
        if (previousMessage && previousMessage == msg) {
            log.debug(`${util.logPrefix('outbox')} ignore duplicate message: ${msg}`)
            return res.status(200).json({ 'ok': true, 'message': msg })
        }

  
        if (updateRegex.test(msg)) {
            log.debug(`${util.logPrefix('outbox')} queue update in outbox: ${msg}`)
            box.push(msg)
            return res.status(201).json({ 'ok': true, 'message': msg })
        }
        else if (queryRegex.test(msg)) {
            log.debug(`${util.logPrefix('outbox')} queue query in outbox: ${msg}`)
            box.push(msg)
            return res.status(201).json({ 'ok': true,  'message': msg  })
        } 
        else {
            log.debug(`${util.logPrefix('outbox')} ignore invalid message ${msg}`)
            return res.status(403).json({ 'ok': false , 'message': msg })
        }
    })

    /**
    * Pull one item off the outbox queue
    */
    serv.post('/api/outbox', (req, res) => {
        let box = res.app.locals.outbox
        let msg = box.shift() || null
        let data = {
            'message': msg,
            'rows': box.length
        }

        if (msg) {
            log.debug(`${util.logPrefix('outbox')} release from queue: ${msg}`)
            return res.status(201).json(data)
        } else {
            return res.status(200).json(data)
        }
    })

}