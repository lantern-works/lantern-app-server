/**
* Lantern Database Watcher
*
*/
const logger = require("./util").Logger;

module.exports = (db) => {

    let node = db.get("__LX__").get("pkg");
    let items = {};

    const watchPackage = (v,package_name) => {
        if (v.hasOwnProperty("version")) {
            let package_id = package_name + "@" + v.version;
            logger.debug(`watch package: ${package_id}`);
            // listen for new and existing items
            node.get(package_name).get("items").map().on((item_id, k) => {
                watchItem(item_id, package_id);
            });
        }
    }

    const watchItem = (item_id, package_id) => {
        if (items[item_id]) {
            logger.warn("already watching: " + item_id);
            return;
        }
        items[item_id] = true;
        logger.debug(`watch item: ${item_id} (${package_id})`);
        let package_name = package_id.split("@")[0];
        let version = package_id.split("@")[1];
        node.get(package_name).get("data").get(version).get(item_id).map().on((v,field_id) => {
            watchField(v, field_id, item_id, package_id)
        });        
        logger.debug("---");


    }

    const watchField = (v, field_id, item_id, package_id) => {
        logger.debug(`${item_id}.${field_id} = `, v);
    }

    // listen for updates
    node.map().on(watchPackage);
}