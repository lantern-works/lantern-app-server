const util = require('./util')
const log = util.DBLogger

// protected database scope
const namespace = '__LX__'
const topLevelFields = ['pkg', 'org', 'ctx']

/**
* Filter PUT At Top-Level
*/
const isTopLevelPutValid = (k, v) => {
    log.debug('[rules] check top level field: ', k, v)
    if (v === null && topLevelFields.indexOf(k) != -1) {
        // do not allow to nullify any top level field
        log.warn(`[rules] prevent a nullify for sacred top-level field: ${k}`)
        return false
    }
    return true
}

/**
* Filter PUT Command
*/
const isPutValid = (k, v) => {
    if (k[0] == '~') {
        // always allow updates to decentralized identities
        log.debug(`[rules] ${k}`)
        return true
    }

    for (var field in v) {
        if (field === '#' || field === '>' || field === '_') {
            // skip metadata
        } else {
            log.debug(`[rules] ${k}.${field} = ${JSON.stringify(v[field])}`)

            if (k === namespace) {
                // special treatment for our top-level of the namespace
                // attempt to preserve a clean base
                return isTopLevelPutValid(field, v[field])
            } else if (field == '%%%bad%%%') {
                log.debug('[rules] test block of save')
                return false
            }
        }
    }
    return true
}

/**
* Database update validator
*/
const rules = (msg) => {
    let user = (msg.headers && msg.headers.token ? msg.headers.token : 'anonymous')
    if (msg.put) {
        log.debug(`[rules] PUT ATTEMPT --------------------------------------------------------------------------------`)
        log.debug(`[rules] @user = ${user}`)

        for (var k in msg.put) {
            let valid = isPutValid(k, msg.put[k])
            if (!valid) {
                log.warn(`[rules] PUT BLOCKED *********************************************************************************\n\n`)
                return false
            }
        }
        log.debug(`[rules] PUT SUCCESS --------------------------------------------------------------------------------\n\n`)
    }
    return true
}

module.exports = rules
