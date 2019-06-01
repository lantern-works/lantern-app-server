const EventEmitter = require('event-emitter-es6')
const View = require('./view')
const Feed = require('./feed')
const User = require('../data/user')
const App = require('./app')
const Package = require('../data/package')
const fetch = window.fetch
require('../../helpers/array')

module.exports = class Context extends EventEmitter {
    constructor (db, user, map) {
        // @todo separate view and model elements into separate classes
        super()
        this.db = db
        this.map = map
        this.user = user
        this.name = null
        this.feed = new Feed(this)
        this.apps = {}
        this.view = new View()
        this.cloud = false
        this.online = false
        this.node = null
        this.priority = 1
        this._id = null
        this.packages = []
    }

    get logPrefix () {
        let tag = this._id ? 'c:' + this._id : 'context'
        return `[${tag}]`.padEnd(20, ' ')
    }

    get id () {
        return this._id
    }

    set id (val) {
        if (!val) {
            this.feed.reset()
            this._id = null
            return
        } else if (val == this._id) {
            return
        }
        this._id = val
        this.node = this.db.get('ctx').get(this._id)
        this.node.once((v, k) => {
            if (!v) {
                return
            }
            this.load(v)
        })
    }

    // ------------------------------------------------------------------------
    load (v) {
        if (v.name) {
            this.name = v.name
        }
        // start fresh
        this.packages = []
        this.feed.reset()

        console.log(`${this.logPrefix} context loaded = ${v.name}`)
        // watch for any packages
        this.node.get('packages').map().once(data => {
            if (data && data.id) {
                let pkg = new LD.Package(data.id, this.db)
                // begin watching package here
                this.feed.addOnePackage(pkg)
                this.packages.push(pkg)
            }
        })
    }

    save () {
        let data = {
            id: this.id,
            name: this.name,
            priority: this.priority
        }
        return db.getOrPut(this.node, data)
    }

    addOnePackage (pkg) {
        return new Promise((resolve, reject) => {
            if (!pkg.node) {
                console.warn(`${this.logPrefix} skip package missing node`, pkg)
                reject('missing_package_node')
                return
            }
            console.log(`${this.logPrefix} adding package to context:`, pkg.id)
            let pkgNode = this.node.get('packages')
            this.db.getOrPut(pkgNode, {})
                .then((saved) => {
                    return pkgNode.set(pkg.node, (ack) => {
                        if (ack.err) {
                            reject(ack.err)
                        } else {
                            resolve()
                        }
                    })
                })
        })
    }

    removeOnePackage (packageNodeId) {
        return new Promise((resolve, reject) => {
            let nodeToRemove = this.node.get('packages').get(packageNodeId)
            console.log(`${this.logPrefix} removing package from context:`, packageNodeId, nodeToRemove)
            this.node.get('packages').unset(nodeToRemove, (ack) => {
                console.log('removed package', ack)
                resolve()
            })
        })
    }

    removeDuplicatePackages () {
        console.log(`${this.logPrefix} checking for duplicates`)

        let pkgListNode = this.node.get('packages')
        let bestPackages = {}

        pkgListNode.once().map((v, k) => {
            console.log(v, k)
            if (!v) {
                return
            }

            let existingPackage = bestPackages[v.id] || null

            // when we have two packages with same identifier, always go with the one with higher sequence
            if (!existingPackage) {
                bestPackages[v.id] = [v, k]
            } else {
                if (existingPackage[0].seq < v.seq) {
                    bestPackages[v.id] = [v, k]
                    this.removeOnePackage(existingPackage[1])
                } else {
                    console.log(`${this.logPrefix} remove package: `,v )
                    this.removeOnePackage(k)
                }
            }
        })
    }

    // ------------------------------------------------------------------------
    /**
    * Load all applications into this context
    */
    loadAllApps () {
        return new Promise((resolve, reject) => {
            // info that may be useful to the browser or environment
            let info = {
                peer: null,
                apps: [],
                online: null,
                cloud: null
            }

            // load in dynamic apps
            fetch('/api/apps', {
                headers: {
                    'Content-Type': 'application/json'
                }
            })
                .then((result) => {
                    if (result.status === 200) {
                        this.peer =  result.headers.get('X-Lantern-Peer')
                        this.online = result.headers.get('X-Lantern-Online') === '1'
                        this.cloud = result.headers.get('X-Lantern-Cloud') === '1'
                        return result.json()
                    } else {
                        reject(result)
                    }
                })
                .then((json) => {
                    json.apps.forEach(item => {
                        this.loadOneApp(item, json.data)
                    })
                    resolve()
                })
                .catch((err) => {
                    console.warn(`${this.logPrefix} No available apps to work with`)
                })
        })
    }

    /**
    * Load one application into this context
    **/
    loadOneApp (item, data) {
        if (!item.children) {
            console.warn(`${this.logPrefix} Ignoring app directory with no children: ${item.name}`)
            return
        }
        if (!this.apps.hasOwnProperty(item.name)) {
            let isolatedData = JSON.parse(JSON.stringify(data))
            let obj = this.apps[item.name] = new App(item, isolatedData, this)
            obj.on('load', (page) => {
                // console.log(`${this.logPrefix} load app component: ${page.componentID}`);
            })

            obj.on('open', (componentID) => {
                // console.log(`${this.logPrefix} open app component: ${componentID}`);
                this.view.data.app_components.push(componentID)
            })

            obj.on('close', (componentID) => {
                // console.log(`${this.logPrefix} close app component: ${componentID}`);
                this.view.data.app_components.remove(componentID)
            })
        }
    }

    // ------------------------------------------------------------------------
    closeOneApp (appID) {
        if (this.apps.hasOwnProperty(appID)) {
            this.apps[appID].pages.forEach((page) => {
                this.apps[appID].close(`lx-app-${appID}-${page.id}`)
            })
        }
    }

    openOneApp (appID) {
        if (this.apps.hasOwnProperty(appID)) {
            this.apps[appID].pages.forEach((page) => {
                this.apps[appID].open(`lx-app-${appID}-${page.id}`)
            })
        }
    }
}
