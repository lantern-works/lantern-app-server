const crypto = require('crypto')
const path = require('path')
const Gun = require('gun')
require('bullet-catcher')
const backup = require('./backup')
const util = require('./util')
const log = util.DBLogger
const rules = require('./rules')

// choose database location
let dbPath = path.resolve(__dirname, '../db/dev')
if (process.env.DB) {
    dbPath = path.resolve(__dirname, '../' + process.env.DB)
}



/**
* Create or use existing database
*/
module.exports = (server,app) => {

    log.setLevel('debug');
    log.info(`${util.logPrefix('db')} path = ${dbPath}`)

    let hash = crypto.createHash('sha1')
    hash.update(String(rules))
    hash.end()
    log.info(`${util.logPrefix('db')} rules = sha1 ${hash.digest('hex')}`)

    let db = Gun({
        file: dbPath,
        web: server,
        localStorage: false,
        isValid: rules
    })


    // attach database instance as a local app variable for express routes
    app.locals.db = db
    return Promise.resolve(dbPath)
}