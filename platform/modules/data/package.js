const EventEmitter = require('event-emitter-es6')

module.exports = class LXPackage extends EventEmitter {
    constructor (name, db) {
        super()

        if (!name) {
            console.error(`${this.logPrefix} please name your package to publish`)
            throw new Error('missing_name')
        }

        let version = '0.0.1' // default version

        if (name.indexOf('@') !== -1) {
            let parts = name.split('@')
            name = parts[0]
            version = parts[1]
        }

        this._data = {
            'name': name,
            'public': true, // only supporting public packages, for now
            'data': {},
            'version': version
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

    get version () {
        return this._data.version
    }

    set version (val) {
        this._data.version = val
    }

    get id () {
        return this._data.name + '@' + this._data.version
    }

    // -------------------------------------------------------------------------
    /**
    * Publish a new data package to the network
    *
    * Attempts a non-destructive put in case other peers have also published
    */
    publish () {
        return new Promise((resolve, reject) => {
            this._data.data[this.version] = {}
            this.node.put(this._data, (ack) => {
                if (ack.err) {
                    return reject('packaged_publish_data_failed')
                }
                console.log(`${this.logPrefix} published version: ${this.id}`)
                resolve()
                this.emit('publish')
            })
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

            console.log(`${this.logPrefix} adding item: ${id}`, item)

            // attach item to the package graph
            let item_node = this.db.get('itm').get(id)
            this.node.get('data').get(this.version).set(item_node)
        })
    }

    remove (item) {
        return new Promise((resolve, reject) => {
            // accept string id or item object
            let id = item.id || item

            console.log(`${this.logPrefix} removing item: ${id}`, item)

            // attach item to the package graph
            let item_node = this.node.get('data').get(this.version).get(id)
            this.node.get('data').get(this.version).unset(item_node)
        })
    }

    // -------------------------------------------------------------------------
    /**
    * Gets a list of all items in the current version of this package
    */
    getItems () {
        return new Promise((resolve, reject) => {
            this.node.get('data').get(this.version).once((v, k) => {
                let item_list = []
                Object.keys(v).forEach((item) => {
                    if (item != '_') {
                        item_list.push(item)
                    }
                })
                resolve(item_list)
            })
        })
    }
}
