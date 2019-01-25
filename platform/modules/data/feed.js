const EventEmitter = require('event-emitter-es6')

module.exports = class LXFeed extends EventEmitter {
    constructor (user) {
        super()
        this.user = user
        this.db = user.db
        this.packages = {} // only watch these
        this.topics = {} // only watch these
        this.watched_items = {}
    }

    // -------------------------------------------------------------------------
    get logPrefix () {
        return `[f:${this.user.username}]`.padEnd(20, ' ')
    }

    /**
    * Watch a single item for any updates
    */
    watchItem (itemID, pkgID) {
        // never watch the same item twice
        if (this.watched_items.hasOwnProperty(itemID)) {
            return
        }
        // console.log(`${this.logPrefix} Watch changes for ${itemID} within package ${pkgID}`)
        this.watched_items[itemID] = false

        let itemNode = this.db.get('itm').get(itemID)

        itemNode.on((v, k) => {
            let event = {
                id: itemID,
                package: pkgID
            }

            this.watched_items[itemID] = true

            if (!v) {
                this.emit('drop', event)
            } else {
                event.data = v
                this.emit('add', event)

            }
        })

        // only allow change event to trigger after an 'add' event
        let node = itemNode.map((v, k) => {
            if (this.watched_items[itemID] === true) {
                this.onDataChange(itemID, pkgID, v, k)
            }
        })
    }

    onDataChange (itemID, pkgID, v, k) {
        let event = {
            id: itemID,
            package: pkgID,
            key: k,
            data: v
        }
        if (this.packages[pkgID]) {
            this.emit('change', event)
        } else {
            console.log('skipping', event)
        }
    }

    /**
    * Allows for manual refresh of data from the feed
    */
    forEachItem (fn) {
        Object.keys(this.packages).forEach(pkgID => {
            if (this.packages[pkgID] === false) {
                return
            }

            console.log(`${this.logPrefix} finding all items for:`, pkgID)
            let parts = pkgID.split('@')
            let name = parts[0]
            let version = parts[1]
            let pkgNode = this.db.get('pkg').get(name).get('data').get(version)
            pkgNode.once((v, k) => {
                if (!v) return
                Object.keys(v).forEach((itemID) => {
                    if (itemID === '_') return

                    let targetNode = pkgNode.get(itemID)
                    let origNode = this.db.get("itm").get(itemID)

                    targetNode.once((v,k) => {

                        if (v) {
                            // make sure we have node in items as expected
                            // handle case where "itm" is cleared but data is still in package
                            // assume we want to preserve this data
                            origNode.once((orig_v) => {
                                if (!orig_v) {
                                    console.warn(`${this.logPrefix} restoring orphan back into item storage`)
                                    this.db.get("itm").set(targetNode)
                                }
                            })
                        }

                        fn(v,k)
                    })
                })
            })
        })
    }

    // -------------------------------------------------------------------------
    addManyPackages (packages) {
        packages.forEach(this.addOnePackage.bind(this))
    }

    addOnePackage (id) {
        var parts, name, version
        try {
            parts = id.split('@')
            name = parts[0]
            version = parts[1]
        } catch (e) {
            console.error(`${this.logPrefix} invalid identifier provided to add package: ${id}`)
            return
        }

        if (this.packages[id]) {
            console.log(`${this.logPrefix} already watching: ${id}`)
            return
        }

        // optimistically assume package exists
        this.packages[id] = true

        let node = this.db.get('pkg').get(name).get('data')

        node.once((v, k) => {
            if (v && v.hasOwnProperty(version)) {
                // verified that version exists
                console.log(`${this.logPrefix} watching changes: ${id}`)
                node
                    .get(version)
                    .map()
                    .on((v, k) => {
                    // start watching for changes
                        this.watchItem(k, id)
                    })
            } else {
                // disable our package subscription if we find out it is missing
                this.packages[id] = false
                console.warn(`${this.logPrefix} missing package version to watch: ${id}`)
            }
        })
    }

    removeManyPackages (packages) {
        packages.forEach(this.removeOnePackage.bind(this))
    }

    removeOnePackage (id) {
        try {
            let parts = id.split('@')
        } catch (e) {
            console.error(`${this.logPrefix} invalid identifier provided to remove package ${id}`)
            return
        }

        console.log(`${this.logPrefix} unwatch changes for ${id}`)
        this.packages[id] = false
    }

    // -------------------------------------------------------------------------
    addManyTopics (topics) {
        topics.forEach(this.addOneTopic.bind(this))
    }

    addOneTopic (name) {
        console.log(`${this.logPrefix} add topic ${name}`)
        this.topics[name] = true
    }

    removeManyTopics (topics) {
        topics.forEach(this.removeOneTopic.bind(this))
    }
    removeOneTopic (name) {
        console.log(`${this.logPrefix} remove topic ${name}`)
        this.topics[name] = false
    }
}
