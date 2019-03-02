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
        let id = this.context.id ? 'f:' + this.context.id : 'no-context'
        return `[${id}]`.padEnd(20, ' ')
    }



    // ------------------------------------------------------------------------
    get activeItems() {
        let obj = {}
        Object.keys(this.items).forEach(key => {
            if (this.items[key] !== false) {
                obj[key] = this.items[key]
            }
        })
        return obj
    }

    get inactiveItems() {
        let obj = {}
        Object.keys(this.items).forEach(key => {
            if (this.items[key] === false) {
                obj[key] = this.items[key]
            }
        })
        return obj
    }


    // ------------------------------------------------------------------------
    /**
    * Watch a single item for any updates
    */
    watchItem (itemID, pkgID, targetNode) {
        // never watch the same item twice
        if (this.items.hasOwnProperty(itemID)) {
            return
        }

        let event = {
            id: itemID,
            package: pkgID
        }

        let itemNode = targetNode.get(itemID)

        itemNode.on((v, k) => {


            if (!this.packages[pkgID]) {
                return
            }

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
                //console.log(`${this.logPrefix} watch item: ${itemID}`, this.packages)
                this.emit('item-watch', event)
            }
        })

        // only allow change event to trigger after an 'add' event
        itemNode.map().on((v, k) => {
            if (this.items[itemID] === false) {
                return
            }
            if (this.packages[pkgID]) {
                this.markDataChange(this.items[itemID], pkgID, v, k)
            }
        }, { change: true })
    }

    markDataChange (item, pkgID, v, k) {
        if (!item) {
            return
        }
        let obj = {}
        obj[k] = v
        item.refresh(obj)
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
                    console.log(`${this.logPrefix} watch package: ${id}`)
                    this.packages[id] = true
                    
                    this.emit("watch", id)

                    targetNode.map()
                    .on((v, k) => {
                        // start watching for changes
                        this.watchItem(k, id, targetNode)
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
            console.log(`${this.logPrefix} unwatch package: ${id}`)
            this.packages[id] = false
            this.emit('unwatch', id)
        }
    }

    reset() {
        this.removeAllPackages()
        this.itemsList.forEach(itemID => {
            //console.log(`${this.logPrefix} unwatch item: ${itemID}`)
            this.emit('item-unwatch', {id: itemID, item: this.items[itemID]})
        })
        this.itemsList.length = 0
        this.items = {}
        this.emit('reset')
    }

}
