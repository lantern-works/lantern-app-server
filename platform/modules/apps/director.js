const EventEmitter = require('event-emitter-es6')
const View = require('./view')
const User = require('../data/user')
const App = require('./app')
const fetch = window.fetch
require('../../helpers/array')

module.exports = class Director extends EventEmitter {
    constructor (db) {
        super()
        this.ready = false
        this.apps = {}
        this.view = new View()
        this.db = db
        this.user = new User(this.db, window.localStorage)
        this._atlas = null
    }

    withUser (fn) {
        if (this.user && this.user.username) {
            fn(this.user)
        } else {
            this.user.once('auth', function () {
                fn(this.user)
            }.bind(this))
        }
    }

    withAtlas (fn) {
        if (this._atlas) {
            fn(this._atlas)
        } else {
            this.once('atlas', function () {
                fn(this._atlas)
            }.bind(this))
        }
    }

    set atlas (val) {
        this._atlas = val
        this.emit('atlas', this._atlas)
    }

    get atlas () {
        return this._atlas
    }

    loadMap(packages) {
        console.log("--------------------------------------------- MAP = " + packages)
        this.withUser((user) => {
            this.user.feed.removeAllPackages()
            this.atlas.removeAllFromMap()
            this.user.feed.addManyPackages(packages)
        })
    }

    loadApps () {
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
                        this.createApp(item, json.data)
                        info.apps.push(item.name)
                    })
                    resolve(info)
                })
                .catch((err) => {
                    console.warn('[Direct] No available apps to work with')
                })
        })
    }

    loadStylesheet (uri) {
        var el = document.createElement('link')
        el.rel = 'stylesheet'
        el.href = uri
        el.type = 'text/css'
        document.head.appendChild(el)
    }

    loadScript (uri) {
        var el = document.createElement('script')
        el.setAttribute('type', 'text/javascript')
        el.src = uri
        document.body.appendChild(el)
    }
    // ------------------------------------------------------------------------
    createApp (item, data) {
        if (!item.children) {
            console.warn('[Direct] Ignoring app directory with no children:', item.name)
            return
        }
        if (!this.apps.hasOwnProperty(item.name)) {
            let isolatedData = JSON.parse(JSON.stringify(data))
            let obj = this.apps[item.name] = new App(item, isolatedData)
            obj.on('load', (page) => {
                // console.log("[Direct] App loads page: ", page.componentID );
            })

            obj.on('open', (componentID) => {
                // console.log("[Direct] App opens component:", componentID);
                this.view.data.app_components.push(componentID)
            })

            obj.on('close', (componentID) => {
                // console.log("[Direct] App closes component:", componentID);
                this.view.data.app_components.remove(componentID)
            })
        }
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
