const Geohash = require('latlon-geohash')
const Item = require('../data/item')
const Location = require('./location')

module.exports = class MarkerItem extends Item {
    constructor (pkg) {
        // now set defaults for key compression
        super(pkg, {
            'label': ['l'],
            'geohash': ['g'],
            'ping': ['p', []],
            'score': ['s']
        })
        this._icon = null
        this._set = null
        this.layer = null
    }

    // -------------------------------------------------------------------------
    /**
    * Defines geographic position on map
    *
    * Automatically create a new map layer if not already defined
    */
    set geohash (val) {
        if (val) {
            let startingVal = this._data.geohash

            try {
                if (val === startingVal) {
                    return
                }

                this._new.geohash = true
                this._data.geohash = val
                // console.log(`${this.logPrefix} location = ${this.geohash}`);

                if (this.layer) {
                    this.layer.setLatLng(this.latlng)
                }
                if (startingVal) {
                    this.emit('move', val)
                }
            } catch (e) {
                console.error(`${this.logPrefix} error with geohash`, e)
            }
        }
    }

    get geohash () {
        return this._data.geohash
    }

    get latlng () {
        return Geohash.decode(this._data.geohash)
    }

    set latlng (val) {
        if (val) {
            this.geohash = Location.toGeohash(val)
        }
    }

    // -------------------------------------------------------------------------

    get label () {
        return this._data.label
    }

    set label (val) {
        if (val && typeof (val) === 'string' && val != this._data.label) {
            this._data.label = val
            this._new.label = true
        }
    }

    // -------------------------------------------------------------------------
    get score () {
        if (this._data.score && isFinite(this._data.score)) {
            return Math.round(parseFloat(this._data.score) * 100) / 100
        } else {
            return 0.00
        }
    }

    set score (val) {
        if (val !== undefined) {
            try {
                // cast to number
                let number = val
                if (typeof (val) !== 'Number') {
                    number = Math.round(parseFloat(val) * 100) / 100
                }
                this._data.score = number
                this._new.score = true
            } catch (e) {
                // could not make a number out of this score. skip...
                console.error(`${this.logPrefix} error with score`, val)
            }
        }
    }

    // -------------------------------------------------------------------------
    /**
    * Get the identity of most recent ping
    */
    get ping () {
        return this._data.ping
    }

    /**
    * Ping should identify username of ping source
    */
    set ping (val) {
        if (val && typeof (val) === 'object' && val.toString() !== this._data.ping.toString()) {
            this._data.ping = val
            this._new.ping = true
        }
    }

    // -------------------------------------------------------------------------
    /**
    * Computes a marker title based on available categories
    */
    getCategory (categories) {
        let title = ''
        let cat = ''
        for (var idx in categories) {
            let item = categories[idx]
            for (var idy in item) {
                let tag = item[idy].tag
                if (this.tags.indexOf(tag) != -1) {
                    if (idx === 'main') {
                        cat = item[idy].label
                    } else {
                        title = item[idy].label
                        return title
                    }
                }
            }
        }
        return 'Unknown Category'
    }

    // -------------------------------------------------------------------------
    getDivIcon () {
        let cls = 'fa'
        if (this._icon) {
            cls += ' fa-' + this._icon
        }
        return window.L.divIcon({
            html: `<i class="${cls}"></i>`,
            className: `lx-marker ${this.tags.join(' ')}`
        })
    }

    get icon () {
        return this._icon
    }

    set icon (value) {
        if (value) {
            // console.log(`${this.logPrefix} icon = ${value}`);
            this._icon = value
            if (this.layer) {
                this.layer.setIcon(this.getDivIcon())
            }
        } else if (value == null) {
            this._icon = null
            // console.log(`${this.logPrefix} clearing icon`);
        }
    }
}
