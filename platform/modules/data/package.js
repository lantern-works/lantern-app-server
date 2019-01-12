"use strict";
const LX = window.LX || {}; if (!window.LX) window.LX = LX;

LX.Package =  class Package extends LV.EventEmitter {

	constructor(name, org) {
		super();

		if (!name) {
            console.error(`${this.log_prefix} please name your package to publish`);
            throw new Error("missing_name")
        }	

        if (!org || !org.db) {
            console.error(`${this.log_prefix} please identify a valid organization for this package`);
            throw new Error("missing_org");  	
        }

		this.db = org.db;
		this.organization = org;
		this._data = {
			"name": name,
			"public": true, // only supporting public packages, for now
            "data": {},
			"version": "0.0.1" // default version number
		}

        this.node = this.db.get("pkg").get(name);   


	}



    //-------------------------------------------------------------------------
    get log_prefix() {
    	return `[p:${this.name || "new package"}@${this.version}]`.padEnd(20, " ");
    }

	get name() {
		return this._data.name;
	}

	set name(val) {
		this._data.name = val;
	}


	get version() {
		return this._data.version;
	}

	set version(val) {
		this._data.version = val;
	}

	get id() {
		return this._data.name +"@"+this._data.version;
	}


   
    //-------------------------------------------------------------------------
    /**
    * Ensures that package exists in database before we work with it
    */
    ensure() {
        return new Promise((resolve, reject) => {
            this.node.once((v,k) => {
                if (v && v.hasOwnProperty("data") && v.hasOwnProperty("version")) {
                    resolve(this);
                }
                else {
                    console.log(`${this.log_prefix} creating package setup: ${this.id}`, this._data);
                    this.node.put(this._data).once(() => {
                        resolve();
                    });
                }
            });

        });
    }

	/**
    * Publish a new data package to the network
    */
    publish(version, data) {
        
        // publishing defaults
        version = version || this._data.version;
        data = data || {};

        return new Promise((resolve, reject) => {
            const completePublish = () => {
                console.log(`${this.log_prefix} will publish: ${this.id}`);
                // we know organization exists, so first link that
                this.node.get("data").get(version).put(null).put(data, (ack) => {
                    if (ack.err) { 
                        return reject("packaged_publish_data_failed");
                    }
                    this.node.get("version").put(version, (ack) => {
                        if (ack.err) {
                            return reject("package_publish_version_failed");
                        }
                        console.log(`${this.log_prefix} new published version: ${this.id}`);
                        resolve();
                        this.emit("publish");
                    });
                });
            }          

            this.ensure().then(() => {
                this.node.get("organization")
                .put(this.organization.node)
                .once(() => {
                    this.organization.node.get("packages").get(this.name).put(this.node);
                })
                .once(() => {
                    this.node.get("data").get(version).once((v,k) => {
                        // do not over-write pre-existing version
                        if (v) {
                            console.log(`${this.log_prefix} already published: ${this.id}`);
                            resolve(v);
                        }
                        else {
                            completePublish();
                        }
                    });
                })
            });

        });
	}

    /*
    * Unpublish removes a data package from the network
    */
    unpublish(version) {
        return new Promise((resolve, reject) => {

            if (!version) {
                console.error(`${this.log_prefix} please specify version to unpublish`);
                return reject("missing_version")
            }   

        	this.node.get("data").get(version || this.version)
                .put(null, (v,k) => {
                this.emit("unpublish");
                return resolve();
            });
        });
    }
}