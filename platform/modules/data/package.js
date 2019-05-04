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
        this.db = db
        this.version = '0.0.1' // default version
        if (name.indexOf('@') !== -1) {
            let parts = name.split('@')
            name = parts[0]
            this.version = parts[1]
        }
        this.name = name
        this.data = {
            id: this.id,
            name: this.name,
            seq: 0,
            items: {}
        } // markers or other item types

        this.node = this.db.get('pkg').get(this.id)

        // keep sequence number up-to-date for package
        this.node.get('seq').on((v, k) => {
            this.seq = v
            // console.log(`${this.logPrefix} sequence update: ${this.seq}`)
        })
    }

    // -------------------------------------------------------------------------
    get logPrefix () {
        return `[p:${this.name || 'new package'}@${this.version}]`.padEnd(20, ' ')
    }

    get id () {
        return this.name + '@' + this.version
    }

    set id (val) {
        if (val) {
            let parts = val.split('@')
            this.name = val[0]
            this.version = val[1]
        }
        this.node = this.db.get('pkg').get(this.id)
    }

    // -------------------------------------------------------------------------
    set seq (val) {
        if (val) {
            this.data.seq = val
        }
    }

    get seq () {
        return this.data.seq
    }

    seqUp () {
        this.node.get('seq').once(v => {
            this.seq = v + 1
        }).put(this.seq)
    }

    // -------------------------------------------------------------------------
    /**
    * Publish a new data package to the network
    *
    * Attempts a non-destructive put in case other peers have also published
    */
    save () {
        return this.db.getOrPut(this.node, this.data)
            .then(saved => {
                if (saved) {
                    this.emit('save')
                    console.log(`${this.logPrefix} saved new packaged: ${this.id}`)
                } else {
                    console.log(`${this.logPrefix} package already exists: ${this.id}`)
                }
                return saved
            })
            .catch((e) => {
                console.error(`${this.logPrefix} failed to save package: ${this.id}`)
            })
    }

    /**
    * Use another node to replace this one
    */
    replace (node) {
        return new Promise((resolve, reject) => {
            this.node.put(node, (ack) => {
                console.log(`${this.logPrefix} package replacement result`, ack)
                resolve()
            })
        })
    }

    /*
    * Unpublish removes a data package from the network
    */
    drop () {
        return new Promise((resolve, reject) => {
            this.node.put(null, (v, k) => {
                this.emit('drop')
                return resolve()
            })
        })
    }

    /*
    * Gets a specific item in the current version of this package
    */
    getOneItem (id) {
        return this.node.get('items').get(id)
    }

    /**
    * Gets a list of all items in the current version of this package
    */
    getAllItems () {
        console.log('get all items')
        return new Promise((resolve, reject) => {
            this.node.get('items').once((v, k) => {
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
