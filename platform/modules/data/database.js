const EventEmitter = require('event-emitter-es6')
const Gun = require('gun')

const rel_ = Gun.val.rel._ // '#'
const node_ = Gun.node._ // '_'

Gun.chain.unset = function (node) {
    this.put({ [node[node_].put[node_][rel_]]: null })
    return this
}

module.exports = class LXDatabase extends EventEmitter {
    constructor (uri) {
        super()
        this.uri = uri
        this.namespace = '__LX__'
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


    // -------------------------------------------------------------------------
    /**
    * Ensure expected nodes are available to work with
    */
    setup () {
        return new Promise((resolve, reject) => {

            // demonstrates write ability and creates database files if non-existing
            // database cannot be setup with simply {} structures
            this.node.get("rnd").put(Math.random(), (ack) => {
                let top_levels = ["org", "pkg", "itm"]
                let count = 0
                const check = () => {                    
                    count++
                    if (count === top_levels.length) {
                        console.log(`${this.logPrefix} database ready`)
                        resolve()
                        this.emit('ready')
                    }
                }
                top_levels.forEach(key => {
                    this.node.get(key).put({}, (ack) => {
                        if (ack.err) {
                            return reject("database_init_ack_failed")
                        }
                        check()
                    })
                })

            })

        })
    }

    // -------------------------------------------------------------------------

    /**
    * Prints out value of a node selected by a path/to/node
    */
    print (path, pointer, node) {
        // recursive attempt to narrow down to target node
        if (!pointer) pointer = path
        if (!node) node = this.node
        let split = pointer.split('/')
        node.get(split[0]).once((v, k) => {
            if (split.length > 1) {
                let new_pointer = split.slice(1).join('/')
                node = node.get(k)
                this.print(path, new_pointer, node)
            } else {
                // we reached the target node here
                console.log(`[DB] ${path} = `, v)
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
    inspect (show_deleted, json, level) {
        let self = this
        if (!json) {
            return self.jsonify().then((new_json) => {
                this.inspect(show_deleted, new_json, level)
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
                if (show_deleted) {
                    console.log(`${level}[ø] ${k}`)
                }
            } else if (typeof (v) === 'object') {
                let length = Object.keys(v).length
                console.log(`${level}[+] ${k}`)
                self.inspect(show_deleted, v, level + '  ')
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

                        if (item === 'organization' || item === 'packages') {
                            // special rule for packages to avoid circular display of organization data
                            promise = new Promise((resolve, reject) => {
                                node.get(item).once((val, key) => {
                                    let names = {}

                                    if (val.name) {
                                        pointer[k][item] = val.name
                                        return resolve(val.name)
                                    }

                                    Object.keys(val).forEach((name) => {
                                        if (name !== '_') names[name] = true
                                    })

                                    pointer[k][item] = names
                                    resolve(names)
                                })
                            })
                        } else if (val !== null && typeof (val) === 'object') {
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
