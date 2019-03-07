const EventEmitter = require('event-emitter-es6')
const shortid = require('shortid')
const SEA = require('sea')

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
        this.clientStorage = clientStorage // typically browser localStorage
        this.once('auth', () => {
            console.log(`${this.logPrefix} sign-in complete`)
        })
    }

    get logPrefix () {
        return `[u:${this.username || 'anonymous'}]`.padEnd(20, ' ')
    }



    // -------------------------------------------------------------------------
    onReady (fn) {
        if (this.username) {
            fn()
        }
        else {
            this.once('auth', fn)
        }
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

}
