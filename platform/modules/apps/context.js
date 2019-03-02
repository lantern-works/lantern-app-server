const EventEmitter = require('event-emitter-es6')
const View = require('./view')
const Feed = require('./feed')
const User = require('../data/user')
const App = require('./app')
const Package = require('../data/package')
const fetch = window.fetch
require('../../helpers/array')

module.exports = class Context extends EventEmitter {

    constructor (db, map, user) {
        super()
        this.db = db
        this.map = map
        this.user = user
        this.feed = new Feed(this)
        this.apps = {}
        this.view = new View()        
        this.cloud = false
        this.online = false
        this._id = null
        this._packages = []
    }

    get logPrefix () {
        let tag = this._id ? 'c:'+this._id : 'context'
        return `[${tag}]`.padEnd(20, ' ')
    }

    get id() {
        return this._id
    }

    set id(val) {
        if (!val) {
            this.feed.reset()
            this._id = val
            return
        }

        this.db.get('ctx').get(val).once((v,k) => {
            if (!v || !v.packages || typeof(v.packages) !== "string") {
                console.warn(`${this.logPrefix} no packages defined for ${val}`)
                return
            }
            this._id = val
            let packages = v.packages.split(',')
            console.log(`${this.logPrefix} packages = ${packages}`)
            this.feed.reset()
            this.feed.addManyPackages(packages)
            this._packages = []
            packages.forEach(pkgId => {
                let pkg = new LD.Package(pkgId, this.db)
                this._packages.push(pkg)
            })
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
                //console.log(`${this.logPrefix} load app component: ${page.componentID}`);
            })

            obj.on('open', (componentID) => {
                //console.log(`${this.logPrefix} open app component: ${componentID}`);
                this.view.data.app_components.push(componentID)
            })

            obj.on('close', (componentID) => {
                //console.log(`${this.logPrefix} close app component: ${componentID}`);
                this.view.data.app_components.remove(componentID)
            })
        }
    }

    // ------------------------------------------------------------------------

    addToPackages(marker) { 
        this._packages.forEach(pkg => {
            pkg.add(marker)
        })
    }

    removeFromPackages(marker) { 
        this._packages.forEach(pkg => {
            pkg.remove(marker)
        })
    }

    // ------------------------------------------------------------------------
    closeOneApp (appID) {
        if (this.apps.hasOwnProperty(appID)) {
            this.apps[appID].unload()
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
