const EventEmitter = require('event-emitter-es6')

module.exports = class Feed extends EventEmitter {
    constructor (context) {
        super()
        this.context = context
        this.db = user.db
        this.packages = {} // only watch these
        this.items = {}
        this.itemsList = []
    }

    // -------------------------------------------------------------------------
    get logPrefix () {
        return `[f:${this.context.id}]`.padEnd(20, ' ')
    }

    /**
    * Watch a single item for any updates
    */
    watchItem (itemID, pkgID) {
        // never watch the same item twice
        if (this.items.hasOwnProperty(itemID)) {
            return
        }
        let event = {
            id: itemID,
            package: pkgID
        }

        let itemNode = this.db.get('itm').get(itemID)

        itemNode.on((v, k) => {
            if (!v) {
                if (this.items[itemID] === false) {
                    return
                }
                event.item = this.items[itemID]
                this.items[itemID] = false
                this.itemsList.remove(itemID)
                this.emit('item-unwatch', event)
            } else {
                
                if (this.items[itemID]) return

                // markers
                let item = null
                if (v.g && v.o && v.t) {
                    item = new LM.MarkerItem(LT.db)
                }
                else {
                    item = new LD.Item(LT.db)
                }
                item.id = itemID
                item.data = v

                this.items[itemID] = item
                if (this.itemsList.indexOf(itemID) == -1) {
                    this.itemsList.push(itemID)
                }

                event.data = v
                event.item = item
                //console.log(`${this.logPrefix} watch item: ${itemID}`)
                this.emit('item-watch', event)
            }
        })

        // only allow change event to trigger after an 'add' event
        itemNode.map().on((v, k) => {
            if (this.items[itemID] === false) {
                return
            }
            this.markDataChange(itemID, pkgID, v, k)
        }, { change: true })
    }

    markDataChange (itemID, pkgID, v, k) {
        let event = {
            id: itemID,
            package: pkgID,
            key: k,
            data: v
        }
        if (this.items[itemID]) {
            event.item = this.items[itemID]
        }
        if (this.packages[pkgID]) {
            this.emit('item-change', event)
        } else {
            console.log('skipping', event)
        }
    }


    // -------------------------------------------------------------------------
    addManyPackages (packages) {
        packages.forEach(this.addOnePackage.bind(this))
    }

    /**
    * @todo to avoid confusion, prevent user from watching the same package with multple versions
    */
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
            // console.log(`${this.logPrefix} already watching: ${id}`)
            return
        }


        let targetNode = this.db.get('pkg')
            .get(name)
            .get('data')
            .get(version)

        targetNode.once((v,k) => {
                if (!v) {
                    console.log(`${this.logPrefix} missing package: ${id}`)
                }
                else {
                    console.log(`${this.logPrefix} begin watching package: ${id}`)
                    this.packages[id] = true
                    
                    this.emit("watch", id)

                    targetNode.map()
                    .on((v, k) => {
                        // start watching for changes
                        this.watchItem(k, id)
                    })
                }
            })
    }

    removeAllPackages () {
        Object.keys(this.packages).forEach(this.removeOnePackage.bind(this))
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

        if (this.packages[id] === true) {
            console.log(`${this.logPrefix} unwatch changes for ${id}`)
            this.packages[id] = false
            this.emit('unwatch', id)
        }
    }

    reset() {
        this.removeAllPackages()
        this.itemsList.forEach(key => {
            this.emit('item-unwatch', {id: key, item: this.items[key]})
        })
        this.itemsList.length = 0
        this.items = {}
    }

}
