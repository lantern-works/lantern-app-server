"use strict";
const LX = window.LX || {}; if (!window.LX) window.LX = LX;

class Atlas extends LV.EventEmitter {
    
    constructor() {
        super();
        this.map = null; // leaflet map
        this.pointer = null; // leaflet location pointer
        this.center = null;
        this.user_location = null;
        this.markers = {
        }
        this.precision = {
            user_max: 4,
            center_max: 10
        };

        let uri_parts = window.location.href.split('/').slice(0, 3);
        this.setTileHost(uri_parts);

        fetch("/api/info").then(data => data.json()).then(data => {
            if (data.online) {
                uri_parts[2] = "{s}.tile.lantern.link";
                this.setTileHost(uri_parts);
            }
        });

        this.tile_db = new LV.PouchDB(LC.leaflet_tiles.dbName, {auto_compaction: true});
        this.user_db = new LV.PouchDB("lx-user", {auto_compaction: true});
        this._map_clicked = 0; // used to distinguish between click and double-click
        this.render();
        
        // find current map cache size...
        // this.tile_db.info().then((result) => {
        //     console.log(`${this.log_prefix} cached tiles: ${result.doc_count}`);
        // });

    }


    setTileHost (val) {
        this.tile_host = val.join("/");
        this.tile_uri = [this.tile_host +"/c/", LC.maptiler.id, "/styles/", 
                LC.maptiler.map, "/{z}/{x}/{y}.png?key=", LC.maptiler.key
            ].join("");
    }

    render() {
        this.setupMap();

        this.setViewFromCenterLocationCache();

        // map event for when location is found...
        this.map.on("locationfound", this.cacheUserLocation.bind(this));

        // map event for when location changes...
        this.map.on("dragend", (e) => {
            this.calculateZoomClass();
            this.cacheCenterLocation();
        });

        this.map.on("zoomend", (e) => {
            this.calculateZoomClass();
            this.cacheCenterLocation();
        });

        this.map.on('click', (e) => {
            this.emit("map-click-start", e);
            this._map_clicked+=1;
            setTimeout(() => {
                if (this._map_clicked == 1) {
                    this._map_clicked = 0;
                    this.emit("map-click", e);
                }
            }, 250);
        });

        this.map.on("dblclick", (e) => {
            this._map_clicked = 0;
            this.emit("map-double-click", e);
        });

    }


    get log_prefix() {
        return "[atlas]".padEnd(20, " ");
    }


    //------------------------------------------------------------------------
    setupMap() {

        // bind dom element for leaflet
        this.map = L.map("map", LC.leaflet_map);

        // layer in hosted map tiles
        L.tileLayer(this.tile_uri, LC.leaflet_tiles).addTo(this.map);

        // stop map from going off-world
        var sw = L.latLng(-89.98155760646617, -180),
        ne = L.latLng(89.99346179538875, 180);
        var bounds = L.latLngBounds(sw, ne);
        this.map.setMaxBounds(bounds);
        this.map.on('drag', function() {
            this.map.panInsideBounds(bounds, { animate: false });
        }.bind(this));

    }

    /**
    * Fly in while zooming
    */
    zoomToPoint(latlng) {
        this.map.flyTo(latlng, Math.limit(this.map.getZoom()+2, 1, LC.leaflet_map.maxZoom), {
            pan: {
                animate: true,
                duration: 1.5
            },
            zoom: {
                animate: true
            }
        });


        this.map.once("moveend", () => {
            this.removePointer();
        });
        
    }

    /**
    * Assign a semantic value we can use for styling similar to mobile breakpoints
    */
    calculateZoomClass() {
        let distance = "close";
        let zoom = this.map.getZoom();

        // map scale breakpoints
        if (zoom < 6) {
            distance = "very-far";
        }
        else if (zoom < 8) {
            distance = "far";
        }
        else if (zoom < 10) {
            distance = "somewhat-far";
        }
        else if (zoom < 14) {
            distance = "normal";
        }
        else if (zoom < 16) {
            distance = "somewhat-close";
        }
        else if (zoom < 18) {
            distance = "close";
        }
        else if (zoom >= 18) {
            distance = "very-close";
        }
        document.body.className=`lx-map-zoom-${distance}`;
        return distance;
    }



    //------------------------------------------------------------------------

    /**
    * Preserves user geolocation in-memory for future use
    */
    cacheUserLocation(e) {
        let new_geo = LX.Location.toGeohash(e.latlng, this.precision.user_max);
        if (new_geo != this.user_location) {
            this.user_location = new_geo;
            console.log(`${log_prefix} New user location found: ${this.user_location}`);    
        }
    }


    /**
    * Preserves center map location with browser-based storage
    */
    cacheCenterLocation(timeout) {

        return new Promise((resolve, reject) => {
            let doc = {
                "_id": "atlas_view",
                "lat": this.map.getCenter().lat,
                "lng": this.map.getCenter().lng,
                "zoom": this.map.getZoom()
            }

            // http://www.bigfastblog.com/geohash-intro
            let precision = Math.round(this.precision.center_max * (doc.zoom/20))
            let gh = LX.Location.toGeohash(doc, precision);
            //console.log(`${this.log_prefix} center geohash: ${gh}`);
            this.center = gh;

            // only save to database if user has paused on this map for a few seconds
            setTimeout(() => {
                if (this.map.getZoom() == doc.zoom 
                    && this.map.getCenter().lat == doc.lat
                    && this.map.getCenter().lng == doc.lng
                    ) {   
                    this.user_db.get("atlas_view").then((old_doc) => {

                        if (JSON.stringify(doc) == JSON.stringify(old_doc)) {
                            // skip save for same location
                            resolve();
                        }
                        else {
                            this.user_db.remove(old_doc).then(() => {
                                this.user_db.put(doc).then(() => {
                                    //console.log(`${this.log_prefix} re-saved center for user`, this.center);
                                    resolve();
                                });
                            });   
                        }
                    })
                    .catch((e) => {
                        this.user_db.put(doc).then(() => {
                            //console.log(`${this.log_prefix} saved center for user`, this.center);
                            resolve();
                        });
                    });
                }
            }, timeout || 7000);
        })
    }

    /**
    * Use saved per-user location to center map
    */
    setViewFromCenterLocationCache() {
        this.user_db.get("atlas_view").then((doc) => {
            this.map.setView([doc.lat, doc.lng], doc.zoom);
        }).catch((e) => {
            this.map.setView([38.42, -12.79], 3);
            // fine if we don't have context or can't retrieve...
            // if we have markers, let's now zoom in on these...
            if (this.markers.length) {
                this.fitMapToAllMarkers();
            }
        });
    }



    //------------------------------------------------------------------------
    /**
    * Add marker to map
    */
    addToMap(marker) {
        if (this.markers[marker.id]) {
            console.log(`${this.log_prefix} ${marker.id} already added to map. skipping...`);
            return;
        }

        marker.layer.addTo(this.map);
        this.markers[marker.id] = marker;
        marker.layer.on("click", (e) => {
            this.emit("marker-click", marker);
        });
        this.emit("marker-add", marker);
    }

    /**
    * Remove marker from map
    */
    removeFromMap(marker) {
        marker.layer.remove();
        this.markers[marker.id] = null;
        this.emit("marker-remove", marker);
    }


    /**
    * Add small dot based on cursor or tap position
    */
    addPointer(latlng) {
        if (this.pointer) return;
        this.pointer = L.circle(latlng, {radius: 1}).addTo(this.map);
        this.emit("pointer-add", {"latlng":latlng});
    }

    /**
    * Remove small dot
    */
    removePointer() {
        if (!this.pointer) return;
        this.pointer.remove();
        this.pointer = null;;
        this.emit("pointer-remove");
    }


    /**
    * Gets count of total number of markers on the map
    */
    getMarkerCount() {
        let count = 0;
        Object.keys(this.markers).forEach(id => {
            if (this.markers[id] !== null) count++;
        });
        return count;
    }

    /**
    * Looks for all markers on map and adjusts view so all are visible
    */
    fitMapToAllMarkers() {
        let all_layers = [];

        Object.keys(this.markers).forEach((key) => {
            let marker = this.markers[key];
            // markers can include null objects from past deleted markers, so ignore those...
            if (marker !== null && marker.hasOwnProperty("layer")) {            
                let layer = marker.layer;
                all_layers.push(layer);
            }
        });

        if (all_layers.length) {
            let group = new L.featureGroup(all_layers);
            this.map.fitBounds(group.getBounds());
        }
    }

    /**
    * Ensures map target is not too close to edge of screen
    */
    moveFromEdge(latlng) {
        let map = this.map;
        let margin = 90;

        return new Promise((resolve, reject) => {
            // are we too close to the edge for our menu?
            let pos = map.latLngToContainerPoint(latlng);
            let dimensions = document.getElementById("map").getBoundingClientRect()
            let center_point = map.getSize().divideBy(2);

            if (pos.x < margin || pos.x > dimensions.width-margin) {
                let direction = (pos.x < margin ? "subtract" : "add");
                let target_point = center_point[direction]([margin, 0]);
                let target_latlng = map.containerPointToLatLng(target_point);
                map.panTo(target_latlng);
                map.once("moveend", () => {
                    resolve(latlng);
                });
            } 
            else if (pos.y < margin || pos.y > dimensions.height-margin) {
                let direction = (pos.y < margin ? "subtract" : "add");
                let target_point = center_point[direction]([0,margin]);
                let target_latlng = map.containerPointToLatLng(target_point);
                map.panTo(target_latlng);
                map.once("moveend", () => {
                    resolve(latlng);
                });
            } 
            else {
                resolve(latlng);
            }
        });
    }    

};

LX.Atlas = new Atlas();