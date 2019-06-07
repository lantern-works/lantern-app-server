const Geohash = require('latlon-geohash')
const GeohashDistance = require('geohash-distance')
const Location = {}

// ------------------------------------------------------------------------
/**
* Attempt to reduce any type of location into a geohash for storage and processing
*/
Location.toGeohash = function (input, precision) {
    precision = precision || 9
    if (typeof (input) === 'string') {
        try {
            Geohash.decode(input)
            return input
        } catch (e) {
            console.log(e)
            console.log('[Location] Sanitize failed for geolocation string', input)
        }
    } else if (typeof (input) === 'object') {
        try {
            if (input.hasOwnProperty('coords')) {
                return Geohash.encode(input.coords.latitude, input.coords.longitude)
            } else if (input.hasOwnProperty('lat') && input.hasOwnProperty('lng')) {
                return Geohash.encode(input.lat, input.lng, precision)
            } else {
                return Geohash.encode(input, precision)
            }
        } catch (e) {
            console.log('[Location] Sanitize failed for geolocation object', input)
        }
    }
}

Location.fromGeohash = function (geohash) {
    return Geohash.decode(geohash)
}

/**
* Calculation distance between two geolocations in kilometers
*/
Location.distanceInKm = function (a, b) {
    let geoA = this.toGeohash(a)
    let geoB = this.toGeohash(b)
    if (geoA && geoB) {
        return GeohashDistance.inKm(geoA, geoB)
    }
}

/**
* Calculation distance between two geolocations in miles
*/
Location.distanceInMiles = function (a, b) {
    let geoA = this.toGeohash(a)
    let geoB = this.toGeohash(b)
    if (geoA && geoB) {
        return GeohashDistance.inMiles(geoA, geoB)
    }
}

module.exports = Location
