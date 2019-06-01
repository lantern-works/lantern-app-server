const EventEmitter = require('event-emitter-es6')
const Package = require('../data/package')

module.exports = class Feed extends EventEmitter {
    constructor (context) {
        super()
        this.context = context
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
    get activeItems () {
        let obj = {}
        Object.keys(this.items).forEach(key => {
            if (this.items[key] !== false) {
                obj[key] = this.items[key]
            }
        })
        return obj
    }

    get inactiveItems () {
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
    watchItem (itemID, pkg) {
        // never watch the same item twice
        if (this.items.hasOwnProperty(itemID)) {
            return
        }

        let event = {
            id: itemID,
            package: pkg.id
        }

        let itemNode = pkg.getOneItem(itemID)

        itemNode.on((v, k) => {
            if (!this.packages[pkg.id]) {
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
                if (v.g && v.t) {
                    // geohash and tags will be enough to display on map
                    item = new LM.MarkerItem(pkg)
                } else {
                    item = new LD.Item(pkg)
                }
                item.id = itemID
                item.data = v

                this.items[itemID] = item
                if (this.itemsList.indexOf(itemID) == -1) {
                    this.itemsList.push(itemID)
                }

                event.data = v
                event.item = item
                // console.log(`${this.logPrefix} watch item: ${itemID}`, this.packages)
                this.emit('item-watch', event)
            }
        })

        // only allow change event to trigger after an 'add' event
        itemNode.map().on((v, k) => {
            if (this.items[itemID] === false) {
                return
            }
            if (this.packages[pkg.id]) {
                this.markDataChange(this.items[itemID], pkg.id, v, k)
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
        var pkg, parts, name, version

        if (id.constructor.name == 'Package') {
            pkg = id
        } else {
            try {
                parts = id.split('@')
                name = parts[0]
                version = parts[1]
            } catch (e) {
                console.error(`${this.logPrefix} invalid identifier provided to add package: ${id}`)
                return
            }
            pkg = new Package(id, this.context.db)
        }

        if (this.packages[pkg.id]) {
            console.log(`${this.logPrefix} already watching: ${pkg.id}`)
            return
        }

        console.log(`${this.logPrefix} watch package: ${pkg.id}`)
        this.packages[pkg.id] = true

        this.emit('watch', {id: pkg.id, package: pkg})

        pkg.node.get('items')
            .map((v, k) => {
                // start watching for changes
                this.watchItem(k, pkg)
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
            this.emit('unwatch', { id: id, package: this.packages[id]})
            this.packages[id] = false
        }
    }

    reset () {
        this.removeAllPackages()
        this.itemsList.forEach(itemID => {
            // console.log(`${this.logPrefix} unwatch item: ${itemID}`)
            this.emit('item-unwatch', { id: itemID, item: this.items[itemID] })
        })
        this.itemsList.length = 0
        this.items = {}
        this.emit('reset')
    }
}
