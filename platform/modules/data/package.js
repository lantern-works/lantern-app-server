const EventEmitter = require('event-emitter-es6')

module.exports = class Package extends EventEmitter {
    constructor (name, db) {
        super()

        if (!name) {
            console.error(`${this.logPrefix} please name your package to publish`)
            throw new Error('missing_name')
        }

        if (!db || db.constructor.name !== 'Database') {
            return console.error('Package requires database to construct')
        }

        this.version = '0.0.1' // default version

        if (name.indexOf('@') !== -1) {
            let parts = name.split('@')
            name = parts[0]
            this.version = parts[1]
        }

        this._data = {
            'name': name,
            'public': true, // only supporting public packages, for now
            'data': {},
            'version': this.version
        }
        this._data.data[this.version] = {
        }
        this.db = db
        this.node = this.db.get('pkg').get(this.name)
    }

    // -------------------------------------------------------------------------
    get logPrefix () {
        return `[p:${this.name || 'new package'}@${this.version}]`.padEnd(20, ' ')
    }

    get name () {
        return this._data.name
    }

    set name (val) {
        this._data.name = val
    }

    get id () {
        return this._data.name + '@' + this.version
    }

    // -------------------------------------------------------------------------
    /**
    * Publish a new data package to the network
    *
    * Attempts a non-destructive put in case other peers have also published
    */
    publish () {
        return this.db.getOrPut(this.node, this._data)
            .then(saved => {
                if (saved) {
                    this.emit('publish')
                    console.log(`${this.logPrefix} published version: ${this.id}`)
                } else {
                    console.log(`${this.logPrefix} already published version: ${this.id}`)
                }
            })
            .catch((e) => {
                console.error(`${this.logPrefix} failed to publish version: ${this.id}`)
            })
    }

    /*
    * Unpublish removes a data package from the network
    */
    unpublish () {
        return new Promise((resolve, reject) => {
            this.node.get('data').get(this.version || this.version)
                .put(null, (v, k) => {
                    this.emit('unpublish')
                    return resolve()
                })
        })
    }

    // -------------------------------------------------------------------------
    /**
    * Adds an item to the current version of this package
    */
    add (item) {
        return new Promise((resolve, reject) => {
            // accept string id or item object
            let id = item.id || item

            console.log(`${this.logPrefix} adding item: ${id}`)

            // attach item to the package graph
            let itemNode = this.db.get('itm').get(id)

            let versionNode = this.node.get('data').get(this.version)
            
            this.db.getOrPut(versionNode, {}).then(saved => {
                versionNode.set(itemNode).once(() => {
                    resolve()                
                })
            })
        })
    }

    remove (item) {
        return new Promise((resolve, reject) => {
            // accept string id or item object
            let id = item.id || item

            console.log(`${this.logPrefix} removing item: ${id}`)

            // attach item to the package graph
            let targetNode = this.node.get('data').get(this.version)
            let itemNode = targetNode.get(id)
            targetNode.unset(itemNode).once(() => {
                resolve()
            })
        })
    }

    // -------------------------------------------------------------------------
    /**
    * Gets a list of all items in the current version of this package
    */
    getItems () {
        return new Promise((resolve, reject) => {
            this.node.get('data').get(this.version).once((v, k) => {
                let itemList = []
                Object.keys(v).forEach((item) => {
                    if (item !== '_') {
                        itemList.push(item)
                    }
                })
                resolve(itemList)
            })
        })
    }
}
