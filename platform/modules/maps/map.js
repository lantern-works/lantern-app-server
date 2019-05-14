/**
* All applications run inside a map context
*/
const EventEmitter = require('event-emitter-es6')
const Location = require('./location')
const MaptileConfig = require('../../config/maptiler')
const LeafletTilesConfig = require('../../config/leafletTiles')
const LeafletMapConfig = require('../../config/leafletMap')
const fetch = window.fetch
require('../../helpers/math')
require('leaflet')

module.exports = class Map extends EventEmitter {
    constructor () {
        super()
        this.view = window.L.map('map', LeafletMapConfig) // leaflet map
    }

    get logPrefix () {
        return '[map]'.padEnd(20, ' ')
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

        // layer in hosted map tiles
        window.L.tileLayer(this.tileUri, LeafletTilesConfig).addTo(this.view)
        // stop map from going off-world
        var sw = window.L.latLng(-89.98155760646617, -180)
        var ne = window.L.latLng(89.99346179538875, 180)
        var bounds = window.L.latLngBounds(sw, ne)
        this.view.setMaxBounds(bounds)

        this.view.on('drag', function () {
            this.view.panInsideBounds(bounds, { animate: false })
        }.bind(this))

        this.view.on('moveend', (e) => {
            this.calculateZoomClass()
        })
        this.calculateZoomClass()

        setTimeout(() => {
            if (!this.view._loaded) {
                this.setDefaultView()
            }
        }, 500)
    }

    // ------------------------------------------------------------------- VIEW
    /**
    * By default center over North America
    */
    setDefaultView () {
        // console.log(`${this.logPrefix} set default view`)
        this.view.setView([38.42, -12.79], 3)
    }

    /**
    * Get center of map in geohash format
    */
    getCenter () {
        return Location.toGeohash(this.view.getCenter())
    }

    /**
    * Get center of map in geohash format
    */
    getCenterAsLatLng () {
        return this.view.getCenter()
    }

    /**
    * Gets center of map in lat/lng/zoom format
    */
    getCenterAsString () {
        return [this.view.getCenter().lat, this.view.getCenter().lng, this.view.getZoom()].join('/')
    }

    /**
    * Check to see if given marker is within view
    */
    isMarkerWithinView (marker) {
        return this.view.getBounds().contains(marker.latlng)
    }

    // ------------------------------------------------------------- ZOOM / PAN
    /**
    * Fly in while zooming
    */
    zoomToPoint (latlng, level) {
        console.log(`${this.logPrefix} zooming to point`, latlng)
        level = level || this.view.getZoom() + 2
        this.view.flyTo(latlng, Math.limit(level, 1, LeafletMapConfig.maxZoom), {
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
        return (LeafletMapConfig.maxZoom - this.view.getZoom() < 1)
    }

    /**
    * Adjusts map to a minimum desired zoom level
    */
    zoomMinimum (level) {
        if (this.view.getZoom() < level) {
            let increase = level - this.view.getZoom()
            console.log(`${this.logPrefix} zooming in extra = ${increase}`)
            this.view.zoomIn(increase)
        }
    }

    /**
    * Pan to a point
    */
    panToPoint (latlng) {
        return new Promise((resolve, reject) => {
            this.view.once('moveend', resolve)
            this.view.panTo(latlng, {
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
        let zoom = this.view.getZoom()

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
    * Looks for all markers on map and adjusts view so all are visible
    */
    fitMapToAllMarkers (markers) {
        if (!markers) {
            console.warn(`${this.logPrefix} must specify markers to fit to map`)
            return
        }
        let allLayers = []
        Object.keys(markers).forEach((key) => {
            let marker = markers[key]
            // markers can include null objects from past deleted markers, so ignore those...
            if (marker !== null && marker.layer) {
                let layer = marker.layer
                allLayers.push(layer)
            }
        })
        // console.log(`${this.logPrefix} fitting map to ${allLayers.length} markers`)
        if (allLayers.length) {
            let group = new window.L.featureGroup(allLayers)
            this.view.fitBounds(group.getBounds())
        }
    }

    // ------------------------------------------------------------------ CACHE

    cacheTiles (lat, lon) {
        let uri = `${this.tileHost.replace('{s}.tile.', '')}/api/tiles/${MaptileConfig.map}/${lat}/${lon}.json?key=${MaptileConfig.key}`
        return fetch(uri, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        })
    }

    /**
    * Cache tiles based on center of map
    */
    cacheTilesFromCenter () {
        // console.log(`${this.logPrefix} caching extra tiles from center of map`);
        this.cacheTiles(this.getCenterAsLatLng().lat, this.getCenterAsLatLng().lng)
    }

    /**
    * Cache tiles based on marker
    */
    cacheTilesFromMarker (marker) {
        if (!marker || !marker.id || !marker.latlng) {
            return
        }
        // console.log(`${this.logPrefix} cache tiles nearby marker ${marker.id} (${marker.geohash})`);
        this.cacheTiles(marker.latlng.lat, marker.latlng.lon)
    }

    // ----------------------------------------------------------------- MARKERS
    /**
    * Add marker to map
    */
    addToMap (marker) {
        if (!marker) {
            console.log(`${this.logPrefix} cannot add missing marker to map`)
            return
        } else if (marker.constructor.name !== 'MarkerItem') {
            console.log(`${this.logPrefix} cannot add non-marker to map with type = ${marker.constructor.name}`)
            return
        }
        else if (marker.layer) {
            console.log(`${this.logPrefix} has layer. cannot add marker to map twice`)
            return
        }
        
        // console.log(`${this.logPrefix} add ${marker.id}`, marker.latlng)

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

        marker.layer.addTo(this.view)

        if (marker.mode == 'draft') {
            // special behaviors for permanent markers, only...
            return
        }

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
        this.emit('marker-remove', marker)
    }

    /**
    * Remove all markers from map
    */
    removeAllFromMap (markers) {
        if (!markers) {
            console.warn(`${this.logPrefix} must specify markers to remove from map`)
            return
        }
        Object.keys(markers).forEach(id => {
            if (markers[id] !== null) {
                this.removeFromMap(markers[id])
            }
        })
    }
}
