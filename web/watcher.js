/**
* Lantern Database Watcher
*
*/
const logger = require("./util").Logger;
const path = require("path");
const spawnSync = require('child_process').spawnSync;

module.exports = (db) => {

    let node = db.get("__LX__").get("pkg");
    let packages = {};
    let items = {};
    let change_hooks = {
        "add": null,
        "update": null,
        "remove": null
    };
    let loaded = false;


    /**
    * Check to see if we have any change hooks from environment
    */
    Object.keys(change_hooks).forEach((key) => {
        let env_var = "HOOK_"+key.toUpperCase();
        if (process.env.hasOwnProperty(env_var)) {
            change_hooks[key] = path.resolve(__dirname+"/../"+process.env[env_var]);
        }
    });

    /**
    * Run an executable to process a change on external system
    */
    const runChangeHook = (key,msg) => {
        if (change_hooks.hasOwnProperty(key) && typeof(change_hooks[key]) == "string") {
            let compressed_msg = msg.replace(/\s/g, "");
            let result = spawnSync(change_hooks[key], [compressed_msg]);
            // console.log("change hook result = ", String(result.stdout));            
        }
    }


    /**
    * Watch for and announce changes to given package
    */
    const watchPackage = (v,package_name) => {

        if (v === null) {
            logger.warn("package removed: " + package_name);
            return;
        }

        if (packages[package_name]) {
            logger.warn("already watching: " + package_name);
            return;
        }

        packages[package_name] = true;
        if (v.hasOwnProperty("version")) {
            let package_id = package_name + "@" + v.version;
            // listen for new and existing items
            node.get(package_name).get("data").get(v.version).map().on((item_data, item_id) => {
                watchItem(item_id, item_data, package_id);
            });
        }
    }


    /**
    * Watch for and announce changes to given item
    */
    const watchItem = (item_id, item_data, package_id) => {

        if (item_data === null) {
            // this can be triggered when an item is first created due to the way we use put(null)
            // therefore, only indicate deletions if we already know about a valid item
            if (loaded && items[item_id]) {

                let msg = `${package_id} - ${item_id}`;
                logger.debug(msg);
                runChangeHook("remove", msg);
            }
            return;
        }
        
        if (items[item_id]) return;

        items[item_id] = true;
        if (loaded) {
            let msg = `${package_id} + ${item_id}`;
            logger.debug(msg);
            runChangeHook("add", msg);
        }
        let package_name = package_id.split("@")[0];
        let version = package_id.split("@")[1];

        node.get(package_name).get("data").get(version).get(item_id).map().on((v,field_id) => {
            watchField(v, field_id, item_id, package_id)
        });
    }

    /**
    * Announce changes to given field
    */
    const watchField = (v, field_id, item_id, package_id) => {
        if (loaded) {
            let msg = `${package_id} ^ ${item_id}.${field_id} = ${v}`;
            logger.debug(msg);
            runChangeHook("update", msg);
        }
    }

    // listen for updates
    node.once(() => {
        // don't output initial data load
        setTimeout(() => {
            logger.debug("watching for changes...");
            loaded = true;
        }, 300);
    }).map().on(watchPackage);


}