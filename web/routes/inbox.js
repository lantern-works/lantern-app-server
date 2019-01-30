/**
* Inbox Route
*
* API to manage messages to be processed and turned into database updates
**/
const util = require('../util')
const log = util.Logger
const message = require('../middleware/message')
const bodyParser = require('body-parser')

module.exports = (serv) => {
    const msgApply = {}

    /**
    * Update existing database field
    */
    msgApply.update = (data, db) => {
        return new Promise((resolve, reject) => {
            let obj = {}
            obj[data.field_key] = data.field_value
            getNode(data, db)
                .put(obj).once((v, k) => {
                    resolve(true)
                })
        })
    }

    /**
    * Drop a node from database
    */
    msgApply.drop = (data, db) => {
        return new Promise((resolve, reject) => {
            let node = getNode(data, db)
            node.put(null, (ack) => {
                if (ack.err) {
                    return reject(new Error('inbox_drop_failed'))
                }
                resolve(true)
            })
        })
    }

    /**
    * Retrieve the working node for this message
    */
    const getNode = (data, db) => {
        return db.get('__LX__')
            .get('itm')
            .get(data.item_id)
    }

    // ----------------------------------------------------------------------

    /**
    * List inbox messages received
    */
    serv.get('/api/inbox', (req, res) => {
        let messages = []
        Object.keys(res.app.locals.inbox).forEach(key => {
            messages.push(key)
        })
        res.status(200).json({
            'messages': messages
        })
    })

    /**
    * Accept messages to convert into database updates
    */
    // @todo support multi-message inbox inputs
    serv.put('/api/inbox', bodyParser.json(), message, (req, res) => {
        let msg = req.body.message
        // @todo can make this persistent if needed using a queue
        // log the received messaged for future output
        // also allows us to prevent infinite loops (don't trigger change hooks on incoming messages)
        let msgKey = util.getSimpleMessage(msg)

        let inbox = res.app.locals.inbox

        inbox[msgKey] = inbox[msgKey] || {}
        inbox[msgKey][new Date().getTime()] = req.ip
        log.debug(`${util.logPrefix('inbox')} ${msg}`)
        let inboxfn = msgApply[res.locals.message.type]
        // @todo only run this if our sequence appears to be greater than current database
        // tries to make sure we only update old items
        inboxfn(res.locals.message, req.app.locals.db)
            .then((success) => {
                res.status(201).json({ 'ok': success })
            })
            .catch((e) => {
                res.status(500).json({ 'ok': false, 'err': e.message })
            })
    })
}
