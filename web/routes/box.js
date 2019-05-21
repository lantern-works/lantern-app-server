/**
* Inbox & Outbox Routes
*
* API to manage messages to be processed and turned into database updates
**/
const conf = require('../config')
const util = require('../util')
const log = util.Logger
const bodyParser = require('body-parser')

// @todo add LZMA compression as optional

module.exports = (serv) => {
    const queryRegex = /([A-Za-z0-9\-\_]+)\>\>([A-Za-z]+)\@([0-9\.]+)\:\:([0-9]+)\:\:([0-9]+)\:\:([0-9]+)?(.*)/
    const updateRegex = /([a-zA-Z0-9]+)\^([a-z]*)\=([\w\.]+)/

    /**
    * Convert regular expression match to key/value pairs
    */
    const getCommand = (matches) => {
        let cmd = {
        }
        let keys = {
            0: 'message',
            1: 'peer',
            2: 'package',
            3: 'version',
            4: 'seq',
            5: 'itemCount',
            6: 'timestamp',
            7: 'changes'
        }
        for (var idx in matches) {
            if (keys[idx]) {
                cmd[keys[idx]] = matches[idx]
            }
        }

        cmd.seq = Number(cmd.seq)
        cmd.itemCount = Number(cmd.itemCount)
        cmd.timestamp = Number(cmd.timestamp)

        if (cmd.changes) {
            cmd.changes = cmd.changes.split('|')
            cmd.changes.shift()
        }

        return cmd
    }

    /**
    * Retrieve the working node for the package in this message
    */
    const getPackageNode = (cmd, db) => {
        return db.get('__LX__')
            .get('pkg')
            .get(`${cmd.package}@${cmd.version}`)
            .get('items')
    }

    /**
    * Retrieve the working node for the item in this message
    */
    const getItemNode = (cmd, itemID, db) => {
        return db.get('__LX__')
            .get('pkg')
            .get(`${cmd.package}@${cmd.version}`)
            .get('items')
            .get(itemID)
    }

    const applyChanges = (cmd, outbox, db) => {
        cmd.changes.forEach(change => {
            if (change[change.length - 1] == '-') {
                let itemID = change.substr(0, change.length)
                drop(cmd, itemID, db)
            } else {
                update(cmd, change, db)
            }
        })
    }

    /**
    * Update existing database field
    */
    const update = (cmd, change, db) => {
        return new Promise((resolve, reject) => {
            let match = change.match(updateRegex)
            if (match && match.length === 4) {
                log.debug(`${util.logPrefix('inbox')} attempt change:`, match)
                let itemID = match[1]
                let key = match[2]
                let val = match[3]
                let node = getItemNode(cmd, itemID, db)
                node.get(key).put(val, (ack) => {
                    if (ack.err) {
                        return reject(new Error('inbox_update_failed'))
                    }
                    log.debug(`${util.logPrefix('inbox')} completed update: ${itemID}.${key} = ${val}`)
                    resolve(true)
                })
            } else {
                log.warn(`${util.logPrefix('inbox')} skip update for invalid: ${change}`)
            }
        })
    }

    /**
    * Drop a node from database
    */
    const drop = (cmd, itemID, db) => {
        return new Promise((resolve, reject) => {
            let node = getItemNode(cmd, itemID, db)
            node.once((v, k) => {
                if (!v) {
                    log.warn(`${util.logPrefix('inbox')} skip drop for missing: ${itemID}`)
                } else {
                    node.put(null, (ack) => {
                        if (ack.err) {
                            return reject(new Error('inbox_drop_failed'))
                        }
                        log.debug(`${util.logPrefix('inbox')} completed drop: ${itemID}`)
                        resolve(true)
                    })
                }
            })
        })
    }

    const runQuery = (cmd, outbox, db, msg) => {
        let node = getPackageNode(cmd, db)
        let reply = `${conf.peer}>>${cmd.package}@${cmd.version}` 
        node.once().map((v, k) => {
            if (k != '#' && k != '>') {
                reply += '|' + k
                if (v === null) {
                    reply += '-'
                } else {
                    Object.keys(v).forEach((key) => {
                        if (key != '#' && key != '>') {
                            let val = v[key]
                            // only transmit intended data types
                            if (typeof (val) === 'string' || typeof (val) === 'Number') {
                                reply += `^${key}=${val}`
                            }
                        }
                    })
                }
            }
            // compose a message
        })
        log.debug(`${util.logPrefix('outbox')} query reply: ${reply} (${reply.length})`)
        outbox.push(reply)
    }

    // ----------------------------------------------------------------------

    /**
    * List inbox messages received
    */
    serv.get('/api/inbox', (req, res) => {
        return res.status(200).json({
            'messages': res.app.locals.inbox
        })
    })

    /**
    * Accept messages to convert into database updates
    */
    // @todo support multi-message inbox inputs
    serv.put('/api/inbox', bodyParser.json(), (req, res) => {

        let msg = req.body.message || ""
        log.debug(`${util.logPrefix('inbox')} message: `, req.body.message)

        if (queryRegex.test(msg)) {
            let cmd = getCommand(msg.match(queryRegex))

            res.app.locals.inbox.push(cmd)

            if (cmd.changes) {
                log.debug(`${util.logPrefix('inbox')} accept change request: ${msg}`)
                applyChanges(cmd, res.app.locals.outbox, req.app.locals.db)
                return res.status(201).json({ 'ok': true })
            } else {
                log.debug(`${util.logPrefix('inbox')} accept query: ${msg}`)
                runQuery(cmd, res.app.locals.outbox, req.app.locals.db, msg)
                return res.status(200).json({ 'ok': true })
            }
        } else {
            log.warn(`${util.logPrefix('inbox')} reject message: ${msg}`)
            return res.status(403).json({ 'ok': false })
        }
    })

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
            return res.status(200).json({ 'ok': true })
        }

        if (queryRegex.test(msg)) {
            let cmd = getCommand(msg.match(queryRegex))
            log.debug(`${util.logPrefix('outbox')} queue message: ${msg}`)
            box.push(msg)
            return res.status(201).json({ 'ok': true })
        } else {
            log.debug(`${util.logPrefix('outbox')} ignore invalid message ${msg}`)
            return res.status(403).json({ 'ok': false })
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
