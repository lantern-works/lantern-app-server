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
        this.username = null
        this.clientStorage = clientStorage // typically browser localStorage
    }

    get logPrefix () {
        if (this.username) {
            return `[u:${this.username}]`.padEnd(20, ' ')
        } else {
            return `[u:anonymous]`.padEnd(20, ' ')
        }
    }

    /**
    * Generates a unique color to match the username
    */
    get color () {
        var hash = 0
        for (var i = 0; i < this.username.length; i++) {
            hash = this.username.charCodeAt(i) + ((hash << 5) - hash)
        }
        var color = '#'
        for (var i = 0; i < 3; i++) {
            var value = (hash >> (i * 8)) & 0xFF
            color += ('00' + value.toString(16)).substr(-2)
        }
        return color
    }

    // -------------------------------------------------------------------------
    onReady (fn) {
        if (this.username) {
            fn()
        } else {
            this.once('auth', fn)
        }
    }

    // -------------------------------------------------------------------------
    /**
    * Authenticates the user with decentralized database
    */
    authenticate (username, password) {
        return new Promise((resolve, reject) => {
            if (this.username) {
                    console.log(`${this.logPrefix} already signed-in user ${this.username}`)
                    resolve()
                    return
            }

            if (!username || !password) {
                let err = new Error()
                err.name = 'user_auth_skipped'
                err.message = 'missing username or password to authenticate'
                return reject(err)
            }

            setTimeout(() => {

                this.node.auth(username, password, (ack) => {
                    if (ack.err) {
                        console.warn(`${this.logPrefix} invalid auth`, ack.err)
                        let err = new Error()
                        err.name = 'user_auth_failed'
                        err.message = username + '/' + password
                        reject(err)
                    } else {
                        // @todo secure token to make sure server can trust we are signed in
                        db.token = this.username = username
                        console.log(`${this.logPrefix} sign-in complete`)
                        this.emit('auth')
                        resolve()
                    }
                })
                
            }, 100)
        })
    }

    leave () {
        return new Promise((resolve, reject) => {
            if (this.node) {
                this.node.leave()
                if (this.node._.hasOwnProperty('sea')) {
                    reject('user_failed_leave')
                } else {
                    console.log(`${this.logPrefix} sign-out complete`)
                    db.token = this.username = null
                    this.emit('leave')
                    resolve()
                }
            } else {
                console.log(`${this.logPrefix} already signed out`)
                resolve()
            }
        })
    }

    /**
    * Registers and stores user within decentralized database
    */
    create (username, password) {
        return new Promise((resolve, reject) => {
            username = username || shortid.generate()
            password = password || shortid.generate()
            console.log(`${this.logPrefix} create user with username: ${username}`)
            this.node.create(username, password, (ack) => {
                if (ack.err) {
                    console.log(`${this.logPrefix} unable to save`, ack.err)
                    return reject(new Error('user_create_failed'))
                }
                console.log(`${this.logPrefix} saved to browser`)
                let creds = this.clientStorage.setItem('lx-auth', [username, password].join(':'))
                this.emit('created')
                this.authenticate(username, password)
                    .then(resolve)
            })
        })
    }

    authOrCreate (skipCheck) {
        if (skipCheck) {
            console.log(`${this.logPrefix} make new credentials by explicit request`)
            return this.create()
        } else {
            // check browser for known credentials for this user
            let creds = this.clientStorage.getItem('lx-auth')
            if (!creds) {
                return this.create()
            } else {
                try {
                    let u = creds.split(':')[0]
                    let p = creds.split(':')[1]
                    return this.authenticate(u, p)
                        .catch(err => {
                            // this database may not know about our user yet, so create it...
                            // we assume local storage is a better indicator of truth than database peer
                            return this.create(u, p)
                        })
                } catch (e) {
                    this.clearCredentials()
                    return this.create()
                }
            }
        }
    }

    clearCredentials () {
        console.warn(`${this.logPrefix}  removing invalid creds from storage`)
        this.clientStorage.removeItem('lx-auth')
        console.warn(`${this.logPrefix}  waiting for valid sign in or creation...`)
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
