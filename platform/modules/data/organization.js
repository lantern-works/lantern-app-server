const EventEmitter = require('event-emitter-es6')

module.exports = class LXOrganization extends EventEmitter {
    constructor (id, name, db) {
        super()
        if (!id) {
            return console.error('[Organization] requires id to construct')
        }

        if (!name) {
            return console.error(`[Organiation] please name your organization`)
        }

        if (!db) {
            return console.error('[Organization] requires database to construct')
        }
        this.id = id
        this.db = db
        this._data = {
            "name": name,
            "members": {},
            "packages": {}
        }
        this.node = this.db.get('org').get(this.id)
    }

    // -------------------------------------------------------------------------
    get logPrefix () {
        return `[o:${this.id || 'Organization'}]`.padEnd(20, ' ')
    }

    get name () {
        return this._data.name
    }

    set name (val) {
        this._data.name = val
    }

    // -------------------------------------------------------------------------

    /**
    * Publish a new data package to the network
    */
    register () {
        return new Promise((resolve, reject) => {
            this.node.put(this._data, (ack) => {
                if (ack.err) {
                    return reject('org_register_failed')
                }
                console.info(`${this.logPrefix} registered`, this.name)
                this.emit('register')
                resolve(this.name)
            })
        })
    }

    unregister () {
        return new Promise((resolve, reject) => {
            this.db.get('org').get(this.id)
                .put(null)
                .once((v, k) => {
                    console.log(`${this.logPrefix} unregistered ${this.id}`)
                    this.emit('unregister')
                    return resolve(v)
                })
        })
    }

    // -------------------------------------------------------------------------
    /**
    * Claim ownership over package
    */
    claim (pkg) {
        return new Promise((resolve, reject) => {
            // first, link organization into package
            this.node.get('packages').put({}).set(pkg.node)
            pkg.node.get('organization').put(this.node, (ack) => {
                console.log(`${this.logPrefix} claimed ${pkg.id}`)
                resolve()
            })
        })
    }

    // -------------------------------------------------------------------------
    /**
    * Add member user to the organization
    */
    addOneMember (user) {
        return new Promise((resolve, reject) => {
            this.node.get('members')
                .set(user)
                .once(resolve)
        })
    }

    /**
    * Remove member user from the organization
    */
    removeOneMember (user) {
        return new Promise((resolve, reject) => {
            this.node.get('members')
                .unset(user)
                .once(resolve)
        })
    }
}
