const conf = require('../config')
const headers = require('../middleware/headers')
module.exports = (serv) => {
    serv.get('/api/info', headers, (req, res) => {
        return res.status(200).json({
            'peer': res.app.locals.peer,
            'online': res.app.locals.online,
            'cloud': res.app.locals.cloud,
            'rules': res.app.locals.rules
        })
    })
}
