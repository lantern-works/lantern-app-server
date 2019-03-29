const EventEmitter = require('event-emitter-es6')
require('../../helpers/array')

module.exports = class Query extends EventEmitter {
    constructor (db, pkg) {
        super()
        if (!pkg) {
            return console.error('[Query] requires package to construct')
        }
        this.db = db
        this.package = pkg
        this.params = []
    }

    addParam(fieldID, criteria) {
        this.params.push([fieldID, criteria])
    }

    /**
    * Looks at latest data and composes a query string for us
    * sends out a request like pkg@0.0.1::1:1:1551694707084 (packageID::version::seq::count::datetime)
    */
    // ultimate return seq::id^field=val.    e.g. 4::jrv0er5nHLK7iwOSHlr2^g=drt2rzsg
    compose() {
        return new Promise((resolve, reject) => {
            let query = this.package.id + '::'
            let highest = 0
            this.package.node.get('seq').once(seq => {
                query += (seq || 0) + '::'

                this.package.node.get('items').once(data => {
                    if (!data) return
                    
                    query += `${Object.keys(data).length-1}::`

                    // now append datetime if available
                    if (data.hasOwnProperty('_') && data['_'].hasOwnProperty('>')) {
                        let items = data['_']['>'] 
                        Object.keys(items).forEach(itemID => {
                            let datetime = items[itemID]
                            if (datetime > highest) {
                                highest = datetime
                            }
                        })
                       query += highest
                    }
                    else {
                        query += 0
                    }
                    this.params.forEach(param => {
                        query += '|' + param[0] + '=' + param[1]
                    })

                    resolve(query)
                })
            })
        })
    }

}