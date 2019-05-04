Math.limit = function (val, min, max) {
    return val < min ? min : (val > max ? max : val)
}

/** Converts numeric degrees to radians */
if (typeof (Number.prototype.toRad) === 'undefined') {
    Number.prototype.toRad = function () {
        return this * Math.PI / 180
    }
}
