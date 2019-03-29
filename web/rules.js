const util = require('./util')
const log = util.DBLogger

// protected database scope
const namespace = '__LX__'
const safeguard = ['pkg', 'org', 'ctx']

/**
* Database update validator
*/
const rules = (msg) => {

    let isValid = true

    if (msg.put) {
        isValid = msg.headers && msg.headers.token
        let token = (isValid ? msg.headers.token : null)
        if (msg.put.hasOwnProperty(namespace)) {
            let attempt = msg.put[namespace]
            safeguard.forEach(key => {
                if (attempt[key] === null) {
                    // do not allow to nullify
                    log.debug(`-- BLOCK NULLIFY FOR ${key} --`)
                    return false
                } 
            })
        }
         if (!msg.how || msg.how !== 'mem') {
           log.debug(`--------- PUT ${isValid ? 'valid' : 'blocked'} ---------`)
           log.debug(`%% user token = ${token} %%`)
            Object.keys(msg.put).forEach(k => {
                if (k[0] == '~') return // ignore user-specific puts
                Object.keys(msg.put[k]).forEach(field => {
                    if (field !== '#' && field !== '>'&& field !== '_') {
                        log.debug(`  ${k} ${field} = ${JSON.stringify(msg.put[k][field])}`)
                    }
                })
            })       
           log.debug(`--------- /PUT ${isValid ? 'valid' : 'blocked'} ---------`)
        }
    }
    return isValid
}

module.exports = rules