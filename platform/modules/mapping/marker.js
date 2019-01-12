"use strict";
const LX = window.LX || {}; if (!window.LX) window.LX = LX;


LX.MarkerItem = class MarkerItem extends LX.Item {
    
    constructor(id, data) {



        // now set defaults for key compression
        super(id, data, {
            "geohash": ["g"]
        });

        this._icon = null;
        this._set = null;
        this.layer = null;


        this.on("remove", () => {
            this.hide();
        });

        this.on("mode", (mode) => {
            if (this.layer) {
                // keep dom updated to reflect mode
                this.layer.setIcon(this.getDivIcon());
                //console.log(`${this.log_prefix} mode = `, mode);
            }
        });

        // intercept to see if we have a cached version in our atlas already
        if (LT.atlas.markers[id]) {
            console.warn(`${this.log_prefix} using cached marker from atlas`);
            return LT.atlas.markers[id];
        }
    }



    //-------------------------------------------------------------------------
    /**
    * Defines geographic position on map
    *
    * Automatically create a new map layer if not already defined
    */
    set geohash(val) {
        if (val) {

            let starting_val = this._data.geohash;

            try {

                if (val == starting_val) {
                    return;
                }

                this._new.geohash = true;
                this._data.geohash = val;
                //console.log(`${this.log_prefix} location = ${this.geohash}`);


                if (this.layer) {
                    this.layer.setLatLng(this.latlng);
                }
                if (starting_val) {
                    this.emit("move", val);
                }
            }
            catch(e) {
                console.error(`${this.log_prefix} error with geohash`, e);
            }
        }
    }

    get latlng() {
        return LV.Geohash.decode(this._data.geohash);
    }

    get geohash() {
        return this._data.geohash;
    }

 
 
    //-------------------------------------------------------------------------
    /**
    * Show on map
    */
    show() {

        if (this.layer !== null) {
            return;
        }
        else if (!this.latlng) {
            console.error(`${this.log_prefix} cannot show marker with missing geolocation`);
            return;
        }

        //console.log(`${this.log_prefix} showing marker`, this);

        let self = this;
        this.layer = L.marker(this.latlng, {
            icon: this.getDivIcon(),
            draggable: false,
            autoPan: true
        });

        LT.atlas.addToMap(this);

        //console.log(`${this.log_prefix} Show`, this.layer);

        this.layer.on("dragend", function(e) {
            let latlng = e.target._latlng;
            self.geohash = LV.Geohash.encode(latlng.lat, latlng.lng); 
        });
        this.emit("show", self);
    }

    /**
    * Hide from the map without altering stored data
    */
    hide() {
        //console.log(`${this.log_prefix} Hide`);
        if (this.layer && this.layer._map) {
            LT.atlas.removeFromMap(this);
            this.emit("hide", this);            
        }
    }



    //-------------------------------------------------------------------------
    getDivIcon() {
        let cls = "fa";
        if (this._icon) {
            cls += " fa-"+this._icon;
        }
        return L.divIcon({
            html: `<i class="${cls}"></i>`,
            className: `lx-marker lx-marker-${this.mode} ${this.tags.join(" ")}`
        });
    }
    

    getIcon() {
        return this._icon;
    }

    setIcon(value) {
        if (!this.layer) {
            console.error(`${this.log_prefix} marker must have layer before icon can be set`);
            return;
        }

        if (value) {
            // console.log(`${this.log_prefix} icon = ${value}`);
        }
        else {
            // console.log(`${this.log_prefix} clearing icon`); 
        }
        this._icon = value;
        this.layer.setIcon(this.getDivIcon());
    }

    /**
    * Display custom icon based on marker class names
    */
    setIcons(map) {
        this.tags.forEach((tag) => {
            if (map.hasOwnProperty(tag)) {
                this.setIcon(map[tag]);
            }
        });
    }



}