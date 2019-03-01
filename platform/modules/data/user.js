const EventEmitter = require('event-emitter-es6')
const shortid = require('shortid')
const SEA = require('sea')
const Feed = require('./feed')

module.exports = class User extends EventEmitter {
    constructor (db, clientStorage) {
        super()

        if (!db || db.constructor.name !== 'Database') {
            return console.error('User requires database to construct')
        }
        if (!clientStorage) {
            return console.error('User requires client-side storage to construct')
        }

        this.db = db
        this.node = this.db.stor.user()
        this.pair = null
        this.feed = new Feed(this)
        this.clientStorage = clientStorage // typically browser localStorage

        this.once('auth', () => {
            console.log(`${this.logPrefix} sign-in complete`)
            this.listPackages().then((packages) => {
                console.log(`${this.logPrefix} found packages: ${packages}`)
            })
        })
    }

    get logPrefix () {
        return `[u:${this.username || 'anonymous'}]`.padEnd(20, ' ')
    }

    // -------------------------------------------------------------------------

    /**
    * Authenticates the user with decentralized database
    */
    authenticate (username, password) {
        return new Promise((resolve, reject) => {
            const completeAuth = () => {
                SEA.pair().then((pair) => {
                    this.pair = pair
                    this.emit('auth', this.pair)
                    resolve(this.pair)
                })
            }

            this.node.auth(username, password, (ack) => {
                if (ack.err) {
                    console.warn(`${this.logPrefix} invalid auth`, ack.err)
                    reject(new Error('user_auth_failed'))
                } else {
                    this.username = username
                    completeAuth()
                }
            })
        })
    }

    /**
    * Registers first-time user into the decentralized database
    */
    register (username, password) {
        return new Promise((resolve, reject) => {
            username = username || shortid.generate()
            password = password || shortid.generate()
            console.log(`${this.logPrefix} create user with username: ${username}`)
            this.node.create(username, password, (ack) => {
                if (ack.err) {
                    console.log(`${this.logPrefix} unable to save`, ack.err)
                    return reject(new Error('user_register_failed'))
                }
                console.log(`${this.logPrefix} saved to browser`)
                let creds = this.clientStorage.setItem('lx-auth', [username, password].join(':'))
                this.authenticate(username, password)
                this.emit('registered')
                resolve()
            })
        })
    }

    authOrRegister (skipCheck) {
        if (skipCheck) {
            console.log(`${this.logPrefix} make new credentials by explicit request`)
            return this.register()
        } else {
            // check browser for known credentials for this user
            let creds = this.clientStorage.getItem('lx-auth')
            if (!creds) {
                return this.register()
            } else {
                try {
                    let u = creds.split(':')[0]
                    let p = creds.split(':')[1]
                    return this.authenticate(u, p)
                        .catch(err => {
                            // this database may not know about our user yet, so create it...
                            // we assume local storage is a better indicator of truth than database peer
                            return this.register(u, p)
                        })
                } catch (e) {
                    this.clearCredentials()
                    return this.register()
                }
            }
        }
    }

    clearCredentials () {
        console.warn(`${this.logPrefix}  removing invalid creds from storage`)
        this.clientStorage.removeItem('lx-auth')
        console.warn(`${this.logPrefix}  waiting for valid sign in or registration...`)
    }

    // -------------------------------------------------------------------------

    /**
    * List packages which are installed for this user
    */
    listPackages () {
        return new Promise((resolve, reject) => {
            let node = this.node.get('packages')
            node.once((v, k) => {
                let packages = []
                if (!v) {
                    return resolve(packages)
                }
                Object.keys(v).forEach((pkg) => {
                    if (pkg === '_' || pkg === '#' || v[pkg] === null) return
                    if (typeof (v[pkg]) !== 'string') {
                        console.warn(`${this.logPrefix} Nullifying non-string value for ${pkg} package:`, v[pkg])
                        node.get(pkg).put(null)
                    } else {
                        packages.push(pkg + '@' + v[pkg])
                    }
                })
                resolve(packages)
            })
        })
    }
    /**
    * Installs a package for a given user and thereby makes available to end-user device
    */
    install (pkg) {
        // allows either a package object or a string representation of pkg@version
        let pkgID = pkg
        if (typeof (pkg) === 'object') {
            pkgID = `${pkg.name}@${pkg.version}`
        }
        let pkgName = pkgID.split('@')[0]
        let pkgVersion = pkgID.split('@')[1]

        return this.db.getOrPut(this.node.get('packages'), {})
            .then(saved => {
                return this.db.getOrPut(this.node.get('packages').get(pkgName), pkgVersion)
                    .then(saved => {
                        // console.log(`${this.logPrefix} ${saved ? 'installed ' : 'already installed'} package ${pkgID}`)
                        if (saved) {
                            this.emit('install', pkgID)
                        }
                        this.feed.addOnePackage(pkgID)
                    })
            })
    }

    /**
    * Removes a package for a given user and cleans up references to related data
    */
    uninstall (pkg) {
        return new Promise((resolve, reject) => {
            this.node.get('packages').get(pkg.name)
                .put(null)
                .once((v, k) => {
                    console.log(`${this.logPrefix} uninstalled package ${pkg.name}`)
                    this.node.get('packages').get(pkg.name).put(null)
                    this.feed.removeOnePackage(pkg.name)
                    this.emit('uninstall', pkg.name)
                    resolve()
                })
        })
    }

    // -------------------------------------------------------------------------
    encrypt (data) {
        return new Promise((resolve, reject) => {
            SEA.encrypt(data, this.pair, (enc) => {
                SEA.sign(enc, this.pair, (signedData) => {
                    console.log(`${this.logPrefix} encrypted / signed data: ${signedData}`)
                    resolve(signedData)
                })
            })
        })
    }

    // -------------------------------------------------------------------------

    /**
    * List topics the user has subscribed to and wants to receive data for
    */
    listTopics () {
        this.node.get('topics').once((v, k) => {
            if (!v) return
            Object.keys(v).forEach((pkg) => {
                if (pkg === '_' || v[pkg] === null) return
                console.log(`${this.logPrefix} subscribed topics ${pkg}:`, v[pkg])
            })
        })
    }

    /**
    * Explicitly gather data on a given topic from available packages
    */
    subscribe (topic) {
        this.node.get('topics').get(topic).set(true).once(() => {
            console.log(`${this.logPrefix} subscribe to topic ${topic}`)
            this.emit('subscribe', topic)
        })
    }

    /**
    * Remove and stop watching for data on a given topic
    */
    unsubscribe (topic) {
        this.node.get('topics').get(topic).set(false).once(() => {
            console.log(`${this.logPrefix} unsubscribe from topic ${topic}`)
            this.emit('subscribe', topic)
        })
    }



    // -------------------------------------------------------------------------
    getMarker() {
        return new Promise((resolve, reject) => {
            this.node.get('marker').once((markerId,k) => {
                if (!markerId) {
                    return resolve()
                }

                if (typeof(markerId) !== 'string') {
                    console.log(`${this.logPrefix} clearing invalid marker format`, markerId)
                    this.clearMarker().then(resolve)
                    return
                }

                this.db.get('itm').get(markerId).once((data) => {
                    resolve(data)
                })
            })
        })
    }

    clearMarker() {
        return new Promise((resolve, reject) => {
            this.node.get('marker').once(markerId => {
                if (markerId) {
                    this.node.get('marker').put(null)
                    this.db.get('itm').get(markerId).put(null).once(() => {
                        resolve()                        
                    })
                }
            })
        })
    }

    setMarker (marker) {
        return new Promise((resolve, reject) => {
            this.node.get('marker').put(marker.id).once((v,k) => {
                resolve()
            })
        })
    }
}
