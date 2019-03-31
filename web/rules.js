const util = require('./util')
const log = util.DBLogger

// protected database scope
const namespace = '__LX__'
const safeguard = ['pkg', 'org', 'ctx']

/**
* Marker Validation
*/
const validateMarker = (id, data) => {
    if (data.hasOwnProperty('o') && typeof(data['o']) !== 'string') {
        log.warn(`[rules] missing or invalid owner for marker ${id}`)
        log.warn(data)
        return false
    }
    if (data.hasOwnProperty('t') && (typeof(data['t']) !== 'string' || data['t'][0] != '%')) {
        log.warn(`[rules] missing or invalid tags for marker ${id}`)
        log.warn(data)
        return false
    }
    return true
}

/**
* Removes GunDB specific metadata when analyzing input
*/
const removeMetadata = (data) => {

    let newData = data

    if (typeof(data) == 'object') {

        let meta = ['_', '#', '>']
        newData = {}
        Object.keys(data).forEach(k => {
            if (meta.indexOf(k) == -1) {
                newData[k] = data[k]
            }
        })
    }
    return newData
}

/**
* Database update validator
*/
const rules = (msg) => {

    let isValid = true

    if (msg.put) {
        isValid = msg.headers && msg.headers.token
        let token = (isValid ? msg.headers.token : null)

        // check for required parameters
        Object.keys(msg.put).forEach(id => {
            let item = removeMetadata(msg.put[id])

            // ducktype markers and enforce rules
            if (item.hasOwnProperty('g')) {
                isValid = validateMarker(id, item)
            }
        })


        if (!isValid) return false

        // avoid a top-level namespace reset at any cost to avoid accidents
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

        // listen for messages trying to save to this server
        if ( (!msg.how || msg.how !== 'mem') && msg.hasOwnProperty('><')) {
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
           log.debug(`--------- /PUT ${isValid ? 'valid' : 'blocked'} ---------/n`)
        }
    }

    return isValid
}

module.exports = rules