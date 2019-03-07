const EventEmitter = require('event-emitter-es6')
const shortid = require('shortid')

module.exports = class Item extends EventEmitter {
    constructor (pkg, defaults) {
    
        if (!pkg || pkg.constructor.name !== 'Package') {
            throw new Error('Requires package to be defined')
        }
        super()
        this.id = null
        this.package = pkg
        this._mode = 'draft'

        // create data space for data we allow to be exported to shared database
        this._data = {}
        this._new = {}

        // always include these defaults
        let globalDefaults = {
            'owner': ['o'],
            'editors': ['e', []],
            'tags': ['t', []],
            'signatures': ['@', []]
        }

        this._defaults = Object.assign(globalDefaults, defaults)

        for (var idx in this._defaults) {
            this._data[idx] = this._defaults[idx][1] || null
            this._new[idx] = false
        }

        this._key_table = {}
        this._key_table_reverse = {}
        for (var idy in this._defaults) {
            this._key_table[idy] = this._defaults[idy][0]
            this._key_table_reverse[this._defaults[idy][0]] = idy
        }

        return this
    }

    // -------------------------------------------------------------------------
    inspect () {
        console.log(`${this.logPrefix} data = ${JSON.stringify(this._data)}`)
        console.log(this)
    }

    get logPrefix () {
        return `[i:${this.id}]`.padEnd(20, ' ')
    }

    // ------------------------------------------------------------------- DATA
    get data () {
        return this._data
    }

    set data (val) {
        if (val) {
            let unpackagedData = this.unpack(val)
            Object.keys(unpackagedData).forEach((key) => {
                let val = unpackagedData[key]

                // basic check for expected type
                if (this._defaults[key][1] === []) {
                    // expects to be an array
                    if (val.constructor !== Array) {
                        console.log(`${this.logPrefix} skip set of unexpected value for ${key} = `, val);
                        return
                    }
                }

                this._data[key] = val
                if (this._new[key] == val) {
                    delete this._new[key]
                }
                // if we're passing in data, we assume it's coming from
                // an exising data source and therefore item is shared
                this._mode = 'shared'
            })
        }
    }

    // ------------------------------------------------------------------- OWNER
    /**
    * User that created this item / has primary control of this item
    */
    get owner () {
        return this._data.owner
    }

    /**
    * Defines the owner for this item
    */
    set owner (val) {
        if (!val) return
        if (val !== this._data.owner) {
            this._data.owner = val
            this._new.owner = true
        }
    }

    // ----------------------------------------------------------------- EDITORS
    /**
    * Gets a list of all item editors
    */
    get editors () {
        return this._data.editors
    }

    /**
    * Sets the entire list of editors for this item
    */
    set editors (val) {
        if (!val || val.length === 0) return

        if (typeof (val) === 'object') {
            val.forEach(this.editor.bind(this))
        }
    }

    /**
    * Adds a new editor to the item
    */
    editor (val) {
        if (!val) return
        if (this._data.editors.indexOf(val) > -1) {
            return
        }
        this._data.editors.push(val)
        this._new.editors = true
        this.emit('editor', val)
    } 

    // ------------------------------------------------------------------- SIGNATURES
    get signatures () {
        return this._data.signatures
    }

  set signatures (val) {
        if (!val || val.constructor !== Array) return
        if (val.toString() != this._data.signatures.toString()) {
            this._data.signatures = val
            this._new.signatures = true
        }
    } 

    // -------------------------------------------------------------------- MODE
    get mode () {
        return this._mode
    }
    set mode (val) {
        if (!val) return
        this._mode = val
        this.emit('mode', val)
    }

    // -------------------------------------------------------------------- TAGS
    /**
    * Gets a list of all tags, often used to alter per-app display or logic
    */
    get tags () {
        if (this._data.tags && typeof (this._data.tags) === 'object') {
            return this._data.tags
        } else {
            return []
        }
    }

    /**
    * Sets the entire list of tags with specified array
    */
    set tags (val) {
        if (!val || val.length === 0) return

        if (typeof (val) === 'object') {
            val.forEach(this.tag.bind(this))
        }
    }

    /**
    * Add tag for data filtering and user interface display
    */
    tag (tag) {
        if (!tag) return
        tag = this.sanitizeTag(tag)

        this._data.tags = this._data.tags || []
        // console.log(`${this.logPrefix} tag = `, tag);

        // don't allow duplicate tags
        if (this._data.tags.indexOf(tag) > -1) {
            return
        }

        this._new.tags = true
        this._data.tags.push(tag)
        this.emit('tag', tag)
        return this.tags
    }

    /**
    * Remove tag
    */
    untag (tag) {
        if (!tag) return
        tag = this.sanitizeTag(tag)
        this._data.tags.remove(tag)
        this.emit('untag', tag)
        this._new.tags = true
        return this.tags
    }

    /**
    * Remove all tags
    */
    untagAll () {
        this._data.tags.forEach((tag) => {
            this.emit('untag', tag)
        })
        this._data.tags = []
        this._new.tags = true
        return this.tags
    }

    /**
    * Keep tags lowercase and with dash seperators
    */
    sanitizeTag (tag) {
        return tag.toLowerCase().replace(/[^a-z0-9\-]+/g, '')
    }

    // -------------------------------------------------------------------------
    /**
    * Compresses and formats data for storage in shared database
    *
    * Requires that all data variables are pre-defined in our map for safety
    */
    pack (obj) {
        let newObj = {}
        for (var idx in obj) {
            let v = obj[idx]

            if (v === undefined || v === null) {
                // nothing worth sending over the wire
            } else if (this._key_table.hasOwnProperty(idx)) {
                let k = this._key_table[idx]
                if (v && v.constructor === Array) {
                    if (v.length) {
                        newObj[k] = '%' + v.join(',')
                    }
                    else if (this._new[idx]) {
                        // empty array, all items have been removed
                        newObj[k] = '%'
                    }
                } else {
                    newObj[k] = v
                }
            }
        }
        // console.log(`${this.logPrefix} Packed:`, obj, newObj);
        return newObj
    }

    /**
    * Extracts data from shared database and places back in javascript object
    *
    * Requires that all data variables are pre-defined in our map for safety
    */
    unpack (obj) {
        let newObj = {}
        Object.keys(obj).forEach(idx => {
            let v = obj[idx]

            if (this._key_table_reverse.hasOwnProperty(idx)) {
                let k = this._key_table_reverse[idx]

                if (typeof (v) === 'string') {
                    if (v[0] === 'Å') {
                        // @todo this is deprecated. remove later...
                        v = v.replace('Å', '%')
                    }
                    if (v[0] === '%') {
                        // this is an array. expand it...
                        v = v.replace('%', '').split(',')
                        if (v == "") {
                            // empty array
                            v = []
                        }
                    }
                }


                // basic check for expected type
                if (this._defaults[k][1]) {
                    // expects to be an array
                    if (v.constructor !== Array) {
                        // default value 
                        console.log(`${this.logPrefix} use default rather than unexpected value for ${k} = `, v);
                        v = this._defaults[k][1]
                        return
                    }
                }

                newObj[k] = v
            }
         })

        // console.log(`${this.logPrefix} Unpacked:`, obj, newObj);
        return newObj
    }

    /*
    * Updates the local item with packed data
    */
    refresh (data) {
        let newData = this.unpack(data)
        // only access approved data keys from our map
        // only listen for changes when we have a getter/setter pair
        for (var idx in newData) {
            let pointer = this[idx] || this._data[idx] // try to use a getter if available

            if (JSON.stringify(pointer) !== JSON.stringify(newData[idx])) {
                if (pointer) {
                    if (typeof (pointer) === 'object') {
                        console.log(`${this.logPrefix} changing ${idx} object to ${newData[idx]}`)
                        this.emit('change', idx)
                    } else if (pointer) {
                        console.log(`${this.logPrefix} changing ${idx} from ${this[idx]} to ${newData[idx]}`)
                        this.emit('change', idx)
                    }
                }

                // default to use setter if available
                if (this[idx]) {
                    this[idx] = newData[idx]
                } else {
                    this._data[idx] = newData[idx]
                }
            }
        }
    }

    // -------------------------------------------------------------------------

    // @todo look at parent packages and then increase sequence count


    /**
    * Stores the composed item into a decentralized database
    */
    save (fields) {
        return new Promise((resolve, reject) => {
            // do not operate on locked items
            if (this.mode === 'locked') {
                return reject(new Error('save_failed_locked'))
            }

            // if we have fields to work with, update existing object
            if (fields) {
                return this.update(fields).then(resolve).catch(reject)
            }
            this.mode = 'locked'
            // save to our shared database...
            let obj = this.pack(this._data)
            this.package.getCurrentVersion().set(obj)
                .once((v, k) => {
                    // @todo switch to ack once bug is fixed where ack returns a false error
                    this.id = k
                    // saves locally but we want confirmation from ack
                    console.log(`${this.logPrefix} attempted save`, obj)


                    // clear new state once saved
                    Object.keys(this._new).forEach((item) => {
                        this._new[item] = false
                    })

                    // acknowledge this item is now shared with network
                    this.mode = 'shared'
                    
                    // database assigns unique identifier
                    this.emit('save')
                    console.log(`${this.logPrefix} completed save`, obj)
                    this.package.seqUp()
                    resolve()
                })

        })
    }

    /**
    * Updates only specific fields for an item
    */
    update (fields) {
        return new Promise((resolve, reject) => {
            // do not operate on locked items
            if (this.mode === 'locked') {
                return reject(new Error('update_failed_locked'))
            }

            // require an array of fields
            if (fields.constructor !== Array) {
                console.log(`${this.logPrefix} Update requires fields in array format: ${fields}`)
                return reject(new Error('update_failed_invalid_fields'))
            }

            this.mode = 'locked'
            let data = {}
            if (fields.constructor === Array) {
                fields.forEach((field) => {
                    // make sure we have an update for this field before saving
                    // prevents extraneous data sent over network
                    if (this._new[field]) {
                        data[field] = this._data[field]
                    }
                })
            } else if (typeof (fields) === 'string') {
                data[fields] = this._data[fields]
            }

            let versionNode = this.package.getCurrentVersion()
            let obj = this.pack(data)
            let item = versionNode.get(this.id)
            item.once((v, k) => {
                if (!v) {
                    // trying to update a non-existing item
                    return reject(new Error('update_failed_missing'))
                }
                item.put(obj).once(() => {

                    // @todo switch to ack once bug is fixed where ack returns a false error
                    Object.keys(obj).forEach((key) => {
                        let val = obj[key]
                        console.log(`${this.logPrefix} saved`, key, val)
                    })

                    fields.forEach((field) => {
                        this._new[field] = false
                    })

                    this.emit('save', fields)
                    this.emit('update', fields)
                    this.mode = 'shared'
                    this.package.seqUp()
                    return resolve()
                    
                })
            })
        })
    }

    /**
    * Clears the value of the item and nullifies in database (full delete not possible)
    */
    drop () {
        return new Promise((resolve, reject) => {
            // do not operate on locked items
            if (this.mode === 'locked') {
                return reject(new Error('drop_failed_locked'))
            }

            if (this.mode === 'dropped') {
                // already deleted... skip...
                return resolve()
            }

            let item = this.package.getOneItem(this.id)

            item.once((v, k) => {
                if (!v) {
                    // already dropped
                    console.log(`${this.logPrefix} already dropped`)
                    return resolve()
                }

                item.put(null, (ack) => {
                    if (ack.err) {
                        return reject(new Error('drop_failed'))
                    }
                    console.log(`${this.logPrefix} Dropped`)
                    this.mode = 'dropped'
                    this.emit('drop')
                    this.package.seqUp()
                    return resolve()
                })
            })
        })
    }


    // -------------------------------------------------------------------------
    /**
    * Add your trust to this item
    */
    approve (sig) {
        if (this._data.signatures.indexOf(sig) === -1) {
            this._data.signatures.push(sig)
            this._new.signatures = true
        }
        return this.update(['signatures'])            
    }

    /**
    * Dispute item accuracy
    */
    dispute (sig) {
        if (this._data.signatures.indexOf(sig) !== -1) {
            this._data.signatures.remove(sig)
            this._new.signatures = true
        }
        return this.update(['signatures'])
    }

    hasSignature (sig) {
        return this._data.signatures && this._data.signatures.indexOf(sig) !== -1
    }

}
