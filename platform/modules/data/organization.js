LX.Organization = class Organization extends LV.EventEmitter {

    constructor(id, name, db) {
        super()
        if (!id) {
            return console.error("[Organization] requires id to construct");
        }

        if (!name) {
            return console.error(`[Organiation] please name your organization`);
        }

        if (!db) {
            return console.error("[Organization] requires database to construct");
        }
        this.id = id;
        this.name = name;
        this.db = db;
        this.node = this.db.get("org").get(this.id);
    }
    


    //-------------------------------------------------------------------------
    get log_prefix() {
        return `[o:${this.id || "Organization"}]`.padEnd(20, " ")
    }

    //-------------------------------------------------------------------------

    /**
    * Ensures that organization exists in database before we work with it
    */
    ensure() {
        return this.register();
    }

    /**
    * Publish a new data package to the network
    */
    register() {
        return new Promise((resolve, reject) => {
            
            this.node.once((v,k) => {
                if (v) {
                    console.log(`${this.log_prefix} already registered`);
                    return resolve(v);
                }
                else {
                    // this node may contain fields for "members" and "packages", too
                    this.node.put(null).put({
                        "name": this.name,
                        "members": {},
                        "packages": {}
                    }, (ack) => {
                        if (ack.err) {
                            return reject("org_register_failed");
                        }  
                        console.info(`${this.log_prefix} newly registered`, this.name);
                        this.emit("register");
                        resolve(this.name);
                    });
                }
            });
        });

    }

    unregister() {
        return new Promise((resolve, reject) => {
            this.node
                .put(null)
                .once((v,k) => {
                    console.log(`${this.log_prefix} unregistered ${this.id}`)
                    this.emit("unregister");
                    return resolve(v);
                });
            });
    }



    //-------------------------------------------------------------------------
    /**
    * Add member user to the organization
    */
    addOneMember(user) {
        return new Promise((resolve, reject) => {
            this.node.get("members")
                .set(user)
                .once(resolve);
            });
    }

    /**
    * Remove member user from the organization
    */
    removeOneMember(user) {
        return new Promise((resolve, reject) => {
            this.node.get("members")
                .unset(user)
                .once(resolve);
            });
    }

}