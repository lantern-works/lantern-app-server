const EventEmitter = require('event-emitter-es6')
const Location = require('./location')
const MaptileConfig = require('../../config/maptiler')
const LeafletTilesConfig = require('../../config/leaflet_tiles')
const LeafletMapConfig = require('../../config/leaflet_map')
const fetch = window.fetch
require('../../helpers/math')
require('leaflet')
require('leaflet.locatecontrol')

module.exports = class Atlas extends EventEmitter {
    constructor (clientStorage, online) {
        super()

        if (!clientStorage) {
            return console.error('User requires client-side storage to construct')
        }
        this.clientStorage = clientStorage
        this.map = null // leaflet map
        this.pointer = null // leaflet location pointer
        this.center = null
        this.userLocation = null

        this.markers = {}
        this.markerList = []

        this.precision = {
            user_max: 4,
            center_max: 10
        }

        this._online = online
    }

    get logPrefix () {
        return '[atlas]'.padEnd(20, ' ')
    }

    // -------------------------------------------------------------------- MAP
    setTileHost (useCloud) {
        let uri = window.location.href
        let uriParts = uri.split('/').slice(0, 3)

        if (useCloud) {
            uriParts[2] = '{s}.tile.lantern.link'
        }

        this.tileHost = uriParts.join('/')
        this.tileUri = [this.tileHost + '/styles/',
            MaptileConfig.map, '/{z}/{x}/{y}.png?key=', MaptileConfig.key
        ].join('')

    }

    render (useCloud) {
        this.setTileHost(useCloud)
        this.setupMap()
        this.setViewFromCenterLocationCache()

        // map event for when location is found...
        this.map.on('locationfound', this.cacheUserLocation.bind(this))
 
        this.map.on('moveend', (e) => {
            this.calculateZoomClass()
            this.cacheCenterLocation()
        })

        this.calculateZoomClass()
    }

    setupMap () {
        // bind dom element for leaflet
        this.map = window.L.map('map', LeafletMapConfig)

        // layer in hosted map tiles
        window.L.tileLayer(this.tileUri, LeafletTilesConfig).addTo(this.map)

        // stop map from going off-world
        var sw = window.L.latLng(-89.98155760646617, -180)

        var ne = window.L.latLng(89.99346179538875, 180)
        var bounds = window.L.latLngBounds(sw, ne)
        this.map.setMaxBounds(bounds)
        this.map.on('drag', function () {
            this.map.panInsideBounds(bounds, { animate: false })
        }.bind(this))
    }



    // ------------------------------------------------------------------- VIEW
    /**
    * By default center over North America
    */
    setDefaultView() {        
        this.map.setView([38.42, -12.79], 3)
    }

    /**
    * Use saved per-user location to center map
    */
    setViewFromCenterLocationCache () {
        let ctr = this.clientStorage.getItem('lx-ctr')
        try {
            let parts = ctr.split('/')
            this.map.setView([parts[0], parts[1]], parts[2])
            // console.log(`${this.logPrefix} restoring view = ${parts}`)
        } catch (e) {
            // will fall back to default view if no markers available
            this.setViewFromRandomMarker()
        }
    }

    /*
    * Gets center of map in lat/lng/zoom format
    */
    getCenterAsString () {
        return [this.map.getCenter().lat, this.map.getCenter().lng, this.map.getZoom()].join('/')
    }

    /**
    * Sets view based on a random marker
    */
    setViewFromRandomMarker() {
        let item = this.getRandomMarker()
        if (item) {
            console.log(`${this.logPrefix} set view from random marker = ${item.id}`)
            this.map.setView(item.latlng, 14)
        }
        else {
            this.setDefaultView()
        }
    }

    /**
    * Check to see if given marker is within view
    */
    isMarkerWithinView (marker) {
        return this.map.getBounds().contains(marker.latlng)
    }

    // ------------------------------------------------------------- ZOOM / PAN
    /**
    * Fly in while zooming
    */
    zoomToPoint (latlng, level) {
        level = level || this.map.getZoom() + 2
        this.map.flyTo(latlng, Math.limit(level, 1, LeafletMapConfig.maxZoom), {
            pan: {
                animate: true,
                duration: 1.5
            },
            zoom: {
                animate: true
            }
        })
    }

    /** 
    * Check if we are using max zoom level
    */
    hasMaxZoom () {
        return (LeafletMapConfig.maxZoom - this.map.getZoom() < 1)
    }

    /**
    * Adjusts map to a minimum desired zoom level
    */
    zoomMinimum(level) {
        if (this.map.getZoom() < level) {
            let increase = level-this.map.getZoom()
            console.log(`${this.logPrefix} zooming in extra = ${increase}`)
            this.map.zoomIn(increase)
        }
    }

    /**
    * Pan to a point
    */
    panToPoint (latlng) {
        return new Promise((resolve, reject) => {
            this.map.once('moveend', resolve)
            this.map.panTo(latlng, {
                pan: {
                    animate: true,
                    duration: 1.5
                }
            })
        })
    }

    /**
    * Assign a semantic value we can use for styling similar to mobile breakpoints
    */
    calculateZoomClass () {
        let distance = 'close'
        let zoom = this.map.getZoom()

        // map scale breakpoints
        if (zoom < 6) {
            distance = 'very-far'
        } else if (zoom < 8) {
            distance = 'far'
        } else if (zoom < 10) {
            distance = 'somewhat-far'
        } else if (zoom < 14) {
            distance = 'normal'
        } else if (zoom < 16) {
            distance = 'somewhat-close'
        } else if (zoom < 18) {
            distance = 'close'
        } else if (zoom >= 18) {
            distance = 'very-close'
        }
        document.body.className = `lx-map-zoom-${distance}`
        return distance
    }


    /**
    * Finds a random marker and zooms in
    */
    zoomToRandomMarker () {
        let item = this.getRandomMarker()
        console.log(`${this.logPrefix} zooming to random marker = ${item.id}`)
        this.panToPoint(item.latlng)
        setTimeout(() => {
            this.map.zoomIn(8)
        }, 1500)
    }

    /**
    * Looks for all markers on map and adjusts view so all are visible
    */
    fitMapToAllMarkers () {
        let allLayers = []

        Object.keys(this.markers).forEach((key) => {
            let marker = this.markers[key]
            // markers can include null objects from past deleted markers, so ignore those...
            if (marker !== null && marker.hasOwnProperty('layer')) {
                let layer = marker.layer
                allLayers.push(layer)
            }
        })

        if (allLayers.length) {
            let group = new window.L.featureGroup(allLayers)
            this.map.fitBounds(group.getBounds())
        }
    }

    // ------------------------------------------------------------------ CACHE
    /**
    * Preserves user geolocation in-memory for future use
    */
    cacheUserLocation (e) {
        let newGeo = Location.toGeohash(e.latlng, this.precision.user_max)
        if (newGeo !== this.userLocation) {
            this.userLocation = newGeo
            console.log(`${this.logPrefix} New user location found: ${this.userLocation}`)
        }
    }

    /**
    * Preserves center map location with browser-based storage
    */
    cacheCenterLocation (timeout) {
        return new Promise((resolve, reject) => {
            let origCtr = this.getCenterAsString()
            // http://www.bigfastblog.com/geohash-intro
            let precision = Math.round(this.precision.center_max * (this.map.getZoom() / 20))
            let gh = Location.toGeohash(this.map.getCenter(), precision)
            //console.log(`${this.logPrefix} center geohash: ${gh}`);
            this.center = gh
            // only save to database if user has paused on this map for a few seconds
            setTimeout(() => {
                if (gh === "ew") {
                    // don't bother saving default north american view
                    return
                }
                let newCtr = this.getCenterAsString()
                if (origCtr === newCtr) {
                    this.clientStorage.setItem('lx-ctr', newCtr)
                    //console.log(`${this.logPrefix} caching center geohash: ${gh} (${this.map.getCenter()})`);

                    if (this._online) {
                        this.cacheTilesFromCenter()                        
                    }
                }
            }, timeout || 5000)
        })
    }

    /**
    * Cache tiles based on center of map
    */
    cacheTilesFromCenter() {
        //console.log(`${this.logPrefix} caching extra tiles from center of map`);
        fetch(`${this.tileHost.replace('{s}.tile.', '')}/api/map/${MaptileConfig.map}/${this.getCenterAsString()}.json?key=${MaptileConfig.key}`, {
            method: "PUT",
            headers: {
                'Content-Type': 'application/json'
            }
        })
    }


    // ----------------------------------------------------------------- MARKERS
    /**
    * Add marker to map
    */
    addToMap (marker) {
        if (marker.id && this.markers[marker.id]) {
            console.log(`${this.logPrefix} ${marker.id} already added to map. skipping...`)
            return
        }

        //console.log(`${this.logPrefix} add ${marker.id}`)

        marker.layer = window.L.marker(marker.latlng, {
            icon: marker.getDivIcon(),
            draggable: false,
            autoPan: true,
            riseOnHover: true
        })


        marker.layer.on('dragend', function (e) {
            let latlng = e.target._latlng
            marker.geohash = Location.toGeohash(latlng)
        })

        marker.layer.addTo(this.map)


        if (marker.mode == 'draft') {
            // special behaviors for permanent markers, only...
            return
        }

        this.markers[marker.id] = marker
        this.markerList.push(marker.id)

        marker.layer.on('click', (e) => {
            this.emit('marker-click', marker)
        })
        this.emit('marker-add', marker)
    }

    /**
    * Remove marker from map
    */
    removeFromMap (marker) {
        marker.layer.remove()
        if (marker.id && this.markers[marker.id]) {
            //console.log(`${this.logPrefix} remove ${marker.id}`)
            this.markers[marker.id] = null
            this.markerList.remove(marker.id)
        }
        this.emit('marker-remove', marker)
    }

    /**
    * Remove all markers from map
    */
    removeAllFromMap () {
        Object.keys(this.markers).forEach(id => {
            if (this.markers[id] !== null) {
                this.removeFromMap(this.markers[id])
            }
        })
    }

    /**
    * Gets count of total number of markers on the map
    */
    getMarkerCount () {
        let count = 0
        this.markerList.forEach(id => {
            if (this.markers[id] !== null) count++
        })
        return count
    }

    /**
    * Finds a random marker
    */
    getRandomMarker() {
        this.markerList.forEach(key => {
            if (this.markers[key] === null) {
                keys.remove()
            }
        })
        let item = this.markers[keys[ keys.length * Math.random() << 0]]
        return item
    }

}
