"use strict"

const fs = require("fs-extra");
const exec = require('child_process').exec;
const directoryTree = require("directory-tree");
const path = require("path");
const bodyParser = require("body-parser");
const util = require("../util");
const log = util.Logger;



//----------------------------------------------------------------------
module.exports = (serv) => {

    let apps_dir = path.join(__dirname, "..", "..", "apps");

    /**
    * Delivers basic server information
    */
    serv.get("/api/info", (req,res) => {
        util.checkInternet().then(status => {
            return res.status(200).json({
                "online": status
            });
        });
    });

    /**
    *  Retrieves available applications from this server
    */
    serv.get("/api/apps", (req,res) => {

        if (!fs.existsSync(apps_dir)) {
            return res.status(412).json({
                "ok":false, "message": "Missing apps directory"
            });
        }


        let filtered_tree = directoryTree(apps_dir, {extensions: /\.(html|js|json|css|png|gif|jpg|jpeg)$/});

        let final_result = [];

        util.removeMeta(filtered_tree, "path");
        let result = ( filtered_tree.hasOwnProperty("children") ? filtered_tree.children : []);

        result.forEach((app) => {
            if (app.name[0] != ".") {
                final_result.push(app);
            }
        });
        res.status(200).json(final_result);
           
    })

    /**
    * Update to latest version of apps from git repository
    */
    serv.post("/api/apps", (req, res) => {
        exec("cd " + apps_dir + "; git pull;", (err, stdout, stderr) => {
            let ok = false;
            if (err) {
                log.error("git pull for apps: ", err);
                res.status(500).json({"ok": false});
            }
            else if (stderr) {
                log.error("git pull for apps: ", stderr);
                res.status(500).json({"ok": false});
            }
            else {
                res.status(201).json({"ok": true});
                log.info("git pull for apps: ", stdout);
            }
        });
    });
};