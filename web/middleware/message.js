module.exports = (req, res, next) => {
    /**
    * Regular expressions to identify intent of message
    */
    // @todo  allow match for multi-message separated by ;
    const msgRegex = {
        add: /([0-9]+)\+([a-zA-Z0-9]+)/,
        update: /([0-9]+)\^([a-zA-Z0-9]+)\.([a-z]*)\=([\w\.]+)/,
        drop: /([0-9]+)-([a-zA-Z0-9]+)/
    }

    /**
    * Convert regular expression match to key/value pairs
    */
    const getObject = (matches, type) => {
        let obj = {
            type: type
        }
        let keys = {
            0: 'text',
            1: 'seq',
            2: 'item_id',
            3: 'field_key',
            4: 'field_value'
        }
        for (var idx in matches) {
            if (keys[idx]) {
                obj[keys[idx]] = matches[idx]
            }
        }
        return obj
    }

    if (!req.body.message) {
        return res.status(403).json({
            'ok': false,
            'message': 'Ignoring empty message'
        })
    } else {
        if (typeof (req.body.message) !== 'string') {
            return res.status(403).json({
                'ok': false,
                'message': 'Ignoring invalid message'
            })
        } else {
            Object.keys(msgRegex).forEach((k) => {
                let exp = msgRegex[k]
                if (exp.test(req.body.message)) {
                    res.locals.message = getObject(req.body.message.match(exp), k)
                }
            })

            if (!res.locals.message) {
                return res.status(403).json({
                    'ok': false,
                    'message': 'Ignoring invalid message'
                })
            } else {
                next()
            }
        }
    }
}
