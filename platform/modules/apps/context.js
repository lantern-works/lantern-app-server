const EventEmitter = require('event-emitter-es6')
const View = require('./view')
const Feed = require('./feed')
const User = require('../data/user')
const App = require('./app')
const Package = require('../data/package')
const fetch = window.fetch
require('../../helpers/array')

module.exports = class Context extends EventEmitter {

    constructor (id, db, map, user) {
        super()
        this.id = id
        this.db = db
        this.map = map
        this.user = user
        this.feed = new Feed(this)
        this.apps = {}
        this.view = new View()
        this._packages = []
    }

    get logPrefix () {
        return `[c:${this.id}]`.padEnd(20, ' ')
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
                        info.online = result.headers.get('X-Lantern-Online')
                        info.cloud = result.headers.get('X-Lantern-Cloud')
                        return result.json()
                    } else {
                        reject(result)
                    }
                })
                .then((json) => {
                    json.apps.forEach(item => {
                        this.loadOneApp(item, json.data)
                        info.apps.push(item.name)
                    })
                    resolve(info)
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
    get packages() {
        return this._packages
    }

    set packages(packages) {
        console.log(`${this.logPrefix} packages = ${packages}`)
        this.feed.reset()
        this.feed.addManyPackages(packages)
        this._packages = []
        packages.forEach(pkgId => {
            let pkg = new LD.Package(pkgId, this.db)
            this._packages.push(pkg)
        })
    }

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
