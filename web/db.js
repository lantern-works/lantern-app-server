const path = require('path')
const Gun = require('gun')

const backup = require('./backup')
const util = require('./util')
const log = util.DBLogger

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
    let db = Gun({
        file: dbPath,
        web: server,
        localStorage: false
    })
    db.on('put', (cmd) => {
        if (!cmd.how || cmd.how !== 'mem') {
            Object.keys(cmd.put).forEach(k => {
                log.debug(`--- PUT ${k} ---`)
                Object.keys(cmd.put[k]).forEach(field => {
                    if (field !== '#' && field !== '>'&& field !== '_') {
                        log.debug(`   ${field} = ${JSON.stringify(cmd.put[k][field])}`)
                    }
                })
                log.debug(`--- /PUT ${k} ---\n`)
            })       
        }
    })

    // attach database instance as a local app variable for express routes
    app.locals.db = db
    return Promise.resolve(dbPath)
}