/**
* Inbox Routes
*
* API to manage messages to be processed and turned into database updates
**/
const conf = require('../config')
const util = require('../util')
const log = util.Logger
const bodyParser = require('body-parser')

// @todo add LZMA compression as optional
module.exports = (serv) => {
    const updateRegex = /([A-Za-z0-9\-\_]+)\>\>([A-Za-z\-]+)\@([0-9\.]+)\:\:([0-9]+)\:\:([0-9]+)\|(.*)/
    const queryRegex = /([A-Za-z0-9\-\_]+)\>\>([A-Za-z\-]+)\@([0-9\.]+)\:\:([0-9]+)\:\:([0-9]+)/
    const restrictedKeys = ["#", "<", "_"]
    
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
            6: 'changes'
        }
        for (var idx in matches) {
            if (keys[idx]) {
                cmd[keys[idx]] = matches[idx]
            }
        }
        cmd.seq = Number(cmd.seq)
        cmd.itemCount = Number(cmd.itemCount)

        if (cmd.changes) {
            cmd.changes = cmd.changes.split('|')
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
                let itemID = change.substr(0, change.length - 1)
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
            try {
                let parts = change.split('^')
                let itemID = parts[0]
                parts.shift()
                let node = getItemNode(cmd, itemID, db)
                parts.forEach(pair => {
                    let kv = pair.split('=')
                    let key = kv[0]
                    let val = kv[1]
                    node.get(key).put(val, (ack) => {
                        if (ack.err) {
                            log.error(`${util.logPrefix('inbox')} failed update: ${itemID}.${key} = ${val}`)
                        }
                        else {
                            log.debug(`${util.logPrefix('inbox')} completed update: ${itemID}.${key} = ${val}`)
                        }
                    })

                })
                resolve(true)
            }
            catch(e) {
                log.warn(`${util.logPrefix('inbox')} skip update for invalid: ${change}`)
                reject()
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


    const filterOutMetadata = (raw) => {
        const filtered = Object.keys(raw)
            .filter(key => !restrictedKeys.includes(key))
            .reduce((obj, key) => {
                obj[key] = raw[key]
                return obj
            }, {})
        return filtered
    }

    const markQueryComplete = () => {
        log.info (`${util.logPrefix('inbox')} /query ------------------------------------------------------------------\n`)
    }


    const runQuery = (cmd, outbox, db, msg, replyDelay) => {
        let node = getPackageNode(cmd, db)

        log.info (`${util.logPrefix('inbox')} query ------------------------------------------------------------------`)
        //log.info(cmd)
        node.once((v,k) => {
            const pkgID = `${cmd.package}@${cmd.version}`
            const seq = (v.hasOwnProperty('seq') ? v.seq : 0)

            // sanitize package node
            let pkg = filterOutMetadata(v)
            log.debug(`${util.logPrefix('inbox')} ${pkgID} -- query for package with ${Object.keys(pkg).length} keys`)

            // @todo improve this primitive way to manage async map
            let itemsNode = node.get('items')
            let itemCount = 0
            let itemsProcessed = 0




            // process items within package
            itemsNode.once((v,k) => {
                let items = filterOutMetadata(v)
                itemCount = Object.keys(items).length


                // do we have data that is more up-to-date than the device making the request?
                // hard to be 100% sure due to offline / eventual consistency / clock
                // we can use some heuristics to be somewhat sure

                let score = 100
                // does requestor have fewer items in this package than we do?
                if (cmd.itemCount > itemCount) {
                    score--
                }
                // do we have a sequence number higher than requester?
                if (cmd.seq > seq) {
                    score--
                }
        
                log.debug(`${util.logPrefix('inbox')} ${pkgID} -- query within ${itemCount} items, score is ${score}`)

                itemsNode.once().map((v,k) => {

                    if (score <= 98) {
                        // we probably have an older verrsion
                        itemsProcessed++
                        log.debug(`${util.logPrefix('inbox')} skip update due to score ${score}`)
                        return
                    }

                    let replyData = `${k}`
                    if (v === null) {
                        replyData += '-'
                        //log.debug(`${k} send removal message`)  
                    }
                    else {
                        let item = filterOutMetadata(v)
                        //log.debug(`${k} send update message = ${JSON.stringify(item)}`)
                        Object.keys(item).forEach((key) => {
                            let val = item[key]
                            // only transmit intended data types
                            if (typeof (val) === 'string' || typeof (val) === 'Number') {
                                replyData += `^${key}=${val}`
                            }
                        })
                    }  

                    let msg = `${conf.peer}>>${pkgID}::${seq}::${itemCount}|${replyData}`
                    log.debug(`${util.logPrefix('inbox')} (${msg.length}) ${msg}`)
                    // use prime number to delay outbox message and thereby avoid some issues with over-the-air timing collision
                    setTimeout(() => {
                        outbox.push(msg)
                    }, replyDelay)


                    itemsProcessed++
                    if (itemsProcessed >= itemCount) {
                        markQueryComplete()
                    }
                })
            })


        })
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
        log.debug(`${util.logPrefix('inbox')} (${msg.length}) ${msg}`)
        try {
            if (updateRegex.test(msg)) {
                let cmd = getCommand(msg.match(updateRegex))

                if (!cmd.hasOwnProperty('changes')) {
                    throw new Error('Missing changes for update')
                }
                res.app.locals.inbox.push(cmd)
                log.info(`${util.logPrefix('inbox')} accept change request: ${msg}`)
                applyChanges(cmd, res.app.locals.outbox, req.app.locals.db)
                return res.status(201).json({ 'ok': true })
            } 
            else if (queryRegex.test(msg)) {
                let cmd = getCommand(msg.match(queryRegex))
                res.app.locals.inbox.push(cmd)
                log.info(`${util.logPrefix('inbox')} accept query: ${msg}`)
                runQuery(cmd, res.app.locals.outbox, req.app.locals.db, msg, req.app.locals.prime * 1000)
                return res.status(200).json({ 'ok': true })
            } 
            else {
                throw new Error('Neither query nor update message')
            }
        }
        catch(e) {
            log.error(e)
            log.warn(`${util.logPrefix('inbox')} reject message: ${msg}`) 
            return res.status(403).json({ 'ok': false })
        }
    })

}
