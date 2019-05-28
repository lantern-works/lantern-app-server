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

        // create data space for data we allow to be exported to shared database
        this._data = {}
        this._new = {}

        // always include these defaults
        let globalDefaults = {
            'owner': ['o'],
            'editors': ['e', []],
            'viewers': ['v', []],
            'form': ['f', []],
            'notes': ['n', []],
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
                        console.log(`${this.logPrefix} skip set of unexpected value for ${key} = `, val)
                        return
                    }
                }

                this._data[key] = val
                if (this._new[key] == val) {
                    delete this._new[key]
                }
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

  // ----------------------------------------------------------------- NOTES
    /**
    * Gets a list of all notes
    */
    get notes () {
        return this._data.notes
    }

    /**
    * Sets the entire list of editors for this item
    */
    set notes (val) {
        if (val === null || val === undefined) return

        // always clear out notes when assigning new ones
        this._data.notes.forEach(txt => {
            this.removeNote(txt)
        })
        this._new.notes = true

        if (typeof (val) === 'object') {
            val.forEach(this.note.bind(this))
        }
        else if (typeof (val) === 'string' && val) {
            this._data.notes.push(val)
        }
    }

    /**
    * Adds a new note to the item
    */
    note (val) {
        if (!val) return
        if (this._data.notes.indexOf(val) > -1) {
            return
        }
        this._data.notes.push(val)
        this._new.notes = true
        this.emit('note', val)
    }

    /**
    * Remove note
    */
    removeNote (txt) {
        if (!txt) return
        this._data.notes.remove(txt)
        this.emit('note-removed', txt)
        this._new.notes = true
        return this.notes
    }
 // ----------------------------------------------------------------- VIEWERS
    /**
    * Gets a list of all item viewers
    */
    get viewers () {
        return this._data.viewers
    }

    /**
    * Sets the entire list of viewers for this item
    */
    set viewers (val) {
        if (!val || val.length === 0) return

        if (typeof (val) === 'object') {
            val.forEach(this.viewer.bind(this))
        }
    }

    /**
    * Adds a new editor to the item
    */
    viewer (val) {
        if (!val) return
        if (this._data.viewers.indexOf(val) > -1) {
            return
        }
        this._data.viewers.push(val)
        this._new.viewers = true
        this.emit('viewer', val)
    }

    /**
    * Remove note
    */
    removeViewer (username) {
        if (!username) return
        this._data.viewers.remove(username)
        this.emit('viewer-removed', username)
        this._new.viwers = true
        return this.viewers
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
                    } else if (this._new[idx]) {
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
                        if (v == '') {
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
                        console.log(`${this.logPrefix} use default rather than unexpected value for ${k} = `, v)
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

                if (typeof (pointer) === 'object') {
                    console.log(`${this.logPrefix} changing ${idx} object to ${newData[idx]}`)
                } else {
                    console.log(`${this.logPrefix} changing ${idx} from ${this[idx]} to ${newData[idx]}`)
                }

                // default to use setter if available
                if (this[idx]) {
                    this[idx] = newData[idx]
                } else {
                    this._data[idx] = newData[idx]
                }


                this.emit('change', idx)

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
            // if we have fields to work with, update existing object
            if (fields) {
                return this.update(fields).then(resolve).catch(reject)
            }

            // save to our shared database...
            let obj = this.pack(this._data)

            console.log(`${this.logPrefix} about to save new item`)


            // @todo remove work-around once ack properly returns
            // data is saved properly but fails to properly ack
            const onRemoteSave = ack => {
                if (ack.err) {
                    console.warn(`${this.logPrefix} no ack for save`)
                    // return reject(new Error('save_failed'))
                } else {
                    this.emit('save-remote', obj)
                    console.log(`${this.logPrefix} saved to remote storage in package ${this.package.id}`, obj)
                }
            }

            const onLocalSave = (v, k) => {
                // @todo switch to ack once bug is fixed where ack returns a false error
                this.id = k
                // saves locally but we want confirmation from ack
                console.log(`${this.logPrefix} saved to local storage in package ${this.package.id}`, obj)

                // clear new state once saved
                Object.keys(this._new).forEach((item) => {
                    this._new[item] = false
                })

                // database assigns unique identifier
                this.package.seqUp()
                this.emit('save', obj)
                resolve(v)
            }

            if (this.id) {
                // use existing identifier if available
                this.package.node.get('items').get(this.id).put(obj, onRemoteSave).once(onLocalSave)
            }
            else {
                this.package.node.get('items').set(obj, onRemoteSave).once(onLocalSave)
            }
        })
    }

    /**
    * Updates only specific fields for an item
    */
    update (fields) {
        return new Promise((resolve, reject) => {
            // require an array of fields
            if (fields.constructor === String) {
                fields = [fields]
            }
            else if (fields.constructor !== Array) {
                console.log(`${this.logPrefix} Update requires fields in array format: ${fields}`)
                let err = new Error()
                err.name = 'update_failed_invalid_fields'
                err.message = JSON.stringify(fields)
                return reject(err)
            }

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

            let itemsNode = this.package.node.get('items')
            let obj = this.pack(data)


            // @todo remove work-around once ack properly returns
            // data is saved properly but fails to properly ack
            const onRemoteUpdate = ack => {
                // @todo switch to ack once bug is fixed where ack returns a false error
                if (ack.err) {
                    console.log(`${this.logPrefix} no ack for update`)
                    let err = new Error()
                    err.name = 'update_failed'
                    err.message = fields.join(', ')
                    // return reject(err)
                } else {
                    this.emit('update-remote', fields)
                    console.log(`${this.logPrefix} updated at remote storage in package ${this.package.id}`, obj)
                }
            }

            const onLocalUpdate = (v,k) => {
                console.log(`${this.logPrefix} updated at local storage in package ${this.package.id}`, obj)
                fields.forEach((field) => {
                    this._new[field] = false
                })
                this.package.seqUp()
                this.emit('update', fields)
                return resolve()
            }

            let item = itemsNode.get(this.id)
            item.put(obj, onRemoteUpdate).once(onLocalUpdate)
        })
    }

    /**
    * Clears the value of the item and nullifies in database (full delete not possible)
    */
    drop () {
        return new Promise((resolve, reject) => {
            // do not operate on locked items

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
                    console.log(`${this.logPrefix} dropped`)
                    this.package.seqUp()
                    this.emit('drop')
                    return resolve()
                })
            })
        })
    }

    /**
    * Takes the item stored in a package and links it into another part of the graph
    */ 
    link (node) {
        node.once((v,k) => {
            if (!v) {
                let nodeInPackage = this.package.node.get('items').get(this.id)
                node.put(nodeInPackage)
            }
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
