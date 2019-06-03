const EventEmitter = require('event-emitter-es6')
const Gun = require('gun')
require('../../helpers/string')
const rel_ = Gun.val.rel._ // '#'
const node_ = Gun.node._ // '_'

require('../../../node_modules/gun/nts')

Gun.chain.unset = function (node) {
    this.put({ [node[node_].put[node_][rel_]]: null })
    return this
}

module.exports = class Database extends EventEmitter {
    constructor (uri) {
        super()

        let self = this

        this.uri = uri
        this.namespace = '__LX__'
        this.token = null

        // attach validation
        Gun.on('opt', function (opt) {
            if (opt.once) {
                return
            }
            opt.on('out', function (msg) {
                let to = this.to
                // Adds headers for put
                msg.headers = {
                    token: self.token
                }
                to.next(msg) // pass to next middleware
            })

            opt.on('in', function (msg) {
                if (msg.hasOwnProperty('put') && msg.hasOwnProperty('><')) {
                    self.emit('sync', msg)
                }
                this.to.next(msg)
            })
        })

        this.stor = Gun(this.uri) // database instance
        this.node = this.stor.get(this.namespace) // root node
    }

    // -------------------------------------------------------------------------
    get logPrefix () {
        return `[database]`.padEnd(20, ' ')
    }

    // -------------------------------------------------------------------------
    /**
    * Get node from within root namespace
    */
    get () {
        return this.node.get.apply(this.node, arguments)
    }

    /**
    * Sets value from within root namespace
    */
    put () {
        return this.node.put.apply(this.node, arguments)
    }

    /*
    * Ensures a single node is created within the database
    */
    getOrPut (targetNode, val) {
        return new Promise((resolve, reject) => {
            targetNode.once((v, k) => {
                if (v) {
                    // console.log(`${this.logPrefix} skip put for existing node`, targetNode)
                    if (typeof (v) === 'string' && v.length) {
                        return resolve(false)
                    } else if (typeof (v) === 'number') {
                        return resolve(false)
                    } else if (typeof (v) === 'object') {
                        let keys = Object.keys(v).filter(key => (key !== '_' && key !== '#'))
                        if (keys.length) {
                            return resolve(false)
                        }
                    }
                }
                if (typeof (val) === 'object') {
                    // creates a node we can save to
                    targetNode.put({})
                    targetNode.put(val).once((v, k) => {
                        // won't ack an empty {} but will prepare database
                        // for a future write to this sub-node
                        console.log(`${this.logPrefix} node put callback`, v)
                        resolve(true)
                    })
                } else {
                    // otherwise do create the node
                    targetNode.put(val)
                        .once((v, k) => {
                            resolve(true)
                        })
                }
            })
        })
    }

    // -------------------------------------------------------------------------
    /**
    * Prints out value of a node selected by a path/to/node
    */
    print (path, pointer, node) {
        // recursive attempt to narrow down to target node
        if (!pointer) pointer = path
        if (!node) node = this.node
        let split = pointer.split('/')
        node.get(split[0]).once((v, k) => {
            if (split.length > 1) {
                let newPointer = split.slice(1).join('/')
                node = node.get(k)
                this.print(path, newPointer, node)
            } else {
                // we reached the target node here
                console.log('[DB]' + path + ' = ', v)
            }
        })
        return split.length
    }

    /**
    * Output basic node on .once or .map
    */
    log (v, k) {
        if (!k) {
            // assume get request
            this.get(v).once((v, k) => {
                return this.log(v, k)
            })
        } else {
            let pre = this.logPrefix || '[database]'
            if (v && typeof (v) === 'object') {
                console.log(`${pre} ${k} =`)
                Object.keys(v).forEach((key) => {
                    console.log(`${pre}     ${key}:`, v[key])
                })
            } else {
                console.log(`${pre} ${k} =`, v)
            }
        }
    }

    /**
    *  Print out the graph structure of a specified node
    */
    inspect (showDeleted, json, level) {
        let self = this
        if (!json) {
            return self.jsonify().then((newJSON) => {
                this.inspect(showDeleted, newJSON, level)
            })
        }

        level = level || ''

        Object.keys(json).forEach(k => {
            if (k === '#') return

            let v = json[k]

            // printable value
            let vp = v
            if (typeof (v) === 'String') {
                vp = v.truncate(30)
            }

            if (v === null) {
                if (showDeleted) {
                    console.log(`${level}[ø] ${k}`)
                }
            } else if (typeof (v) === 'object') {
                console.log(`${level}[+] ${k}`)
                self.inspect(showDeleted, v, level + '  ')
            } else {
                console.log(`${level}|- ${k} = `, vp)
            }
        })
    }

    /**
    * Exports data structure to a basic JSON object with hierarchy
    */
    jsonify (node, tree, pointer) {
        let self = this
        node = node || self.node
        tree = tree || {}
        pointer = pointer || tree

        return new Promise((resolve, reject) => {
            if (!node) {
                return reject('Root node missing')
            }

            node.once((v, k) => {
                pointer[k] = {}
                let promises = []
                if (v) {
                    let items = Object.keys(v).filter(key => key !== '_')
                    items.forEach((item) => {
                        var promise
                        let val = v[item]

                        if (val !== null && typeof (val) === 'object') {
                            promise = self.jsonify.apply(self, [node.get(item), tree, pointer[k]])
                        } else {
                            promise = pointer[k][item] = val
                        }
                        promises.push(promise)
                    })
                }

                Promise.all(promises).then((val) => {
                    resolve(tree)
                })
            })
        })
    };
}
