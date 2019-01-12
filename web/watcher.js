/**
* Lantern Database Watcher
*
*/
const logger = require("./util").Logger;

module.exports = (db) => {

    let node = db.get("__LX__").get("pkg");
    let packages = {};
    let items = {};
    let loaded = false;


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

    const watchItem = (item_id, item_data, package_id) => {

        if (item_data === null) {
            // this can be triggered when an item is first created due to the way we use put(null)
            // therefore, only indicate deletions if we already know about a valid item
            if (loaded && items[item_id]) {
                logger.debug(`${package_id} | [-] ${item_id}`);
            }
            return;
        }
        
        if (items[item_id]) return;

        items[item_id] = true;
        if (loaded) {
            logger.debug(`${package_id} | [+] ${item_id}`);
        }
        let package_name = package_id.split("@")[0];
        let version = package_id.split("@")[1];

        node.get(package_name).get("data").get(version).get(item_id).map().on((v,field_id) => {
            watchField(v, field_id, item_id, package_id)
        });
    }

    const watchField = (v, field_id, item_id, package_id) => {
        if (loaded) {
            logger.debug(`${package_id} | [^] ${item_id}.${field_id} = `, v);
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