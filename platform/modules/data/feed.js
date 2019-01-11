"use strict";
const LX = window.LX || {}; if (!window.LX) window.LX = LX;


LX.Feed = class Feed extends LV.EventEmitter {

	constructor(user) {
		super();
        this.user = user;
		this.db = user.db;    
		this.packages = {};  // only watch these
		this.topics = {}; // only watch these

	}
    


    //-------------------------------------------------------------------------
    get log_prefix() {
    	return `[f:${this.user.username}]`.padEnd(20, " ");
    }


    onDataChange(val, id, pkg_id) {

        var data;

        if (val !== null && typeof(val) == "object") {
            data = {};
            Object.keys(val).forEach(k => {
                if (k != "_") {
                    data[k] = val[k];
                }
            });
        }

        let event = {
            id: id,
            package: pkg_id,
            data: data
        };

        if (this.packages[pkg_id]) {
            this.emit("change", event);
        }
        else {
            console.log("skipping", event)
        }
    }

    /**
    * Allows for manual refresh of data from the feed
    */
    refreshData() {
        Object.keys(this.packages).forEach(id => {
            if (this.packages[id] == false) {
                return;
            }

            //console.log(`${this.log_prefix} refreshing data for:`, id)
            let parts = id.split("@");
            let name = parts[0];
            let version = parts[1];
            let package_node = this.db.get("pkg").get(name)
            package_node.get("data")
                .get(version).once((v,k) => {

                    if (!v) return;

                    Object.keys(v).forEach((item) => {
                        if (item == "_") return;
                        package_node.get("data").get(version).get(item)
                        .once((value,key) => {
                            this.onDataChange(value, key, id);
                        });
                    });

                });
        });
    }



    //-------------------------------------------------------------------------
  	addManyPackages(packages) {
    	packages.forEach(this.addOnePackage.bind(this));
    }

    addOnePackage(id) {
        var parts,name,version;
        try {
            parts = id.split("@");
            name = parts[0];
            version = parts[1];            
        }
        catch(e) {
            console.error(`${this.log_prefix} invalid identifier provided to add package: ${id}`);
            return;
        }

    	if (this.packages[id]) {
            console.log(`${this.log_prefix} already watching: ${id}`);
            return;
        }

        // optimistically assume package exists
        this.packages[id] = true;


        let package_node = this.db.get("pkg").get(name);
        package_node.get("data")
            .get(version).once((v,k) => {
                if (v) {
                    // verified that version exists
                    console.log(`${this.log_prefix} watching changes: ${id}`)
                }
                else {
                    // disable our package subscription if we find out it is missing
                    this.packages[id] = false;
                    console.warn(`${this.log_prefix} missing package version to watch: ${id}`)
                }
            })
            .map()
            .on((v,k) => {
                // start watching for changes
                this.onDataChange(v,k,id);
            });

    }


    removeManyPackages(packages) {
    	packages.forEach(this.removeOnePackage.bind(this));
    }

    removeOnePackage(id) {
         try {
            let parts = id.split("@");         
        }
        catch(e) {
            console.error(`${this.log_prefix} invalid identifier provided to remove package ${id}`);
            return;
        }

    	console.log(`${this.log_prefix} unwatch changes for ${id}`)    	
    	this.packages[id] = false;
    }




    //-------------------------------------------------------------------------
    addManyTopics(topics) {
    	topics.forEach(this.addOneTopic.bind(this));
    }

    addOneTopic(name) {    	
    	console.log(`${this.log_prefix} add topic ${name}`)
    	this.topics[name] = true;
    }


    removeManyTopics(topics) {
    	topics.forEach(this.removeOneTopic.bind(this));
    }
    removeOneTopic(name) {
    	console.log(`${this.log_prefix} remove topic ${name}`)
    	this.topics[name] = false;
    }
}