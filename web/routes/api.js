"use strict"

const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");
const util = require("../util");
const log = util.Logger;
const db = util.CoreDatabase;



//----------------------------------------------------------------------
/*
* Allows user to easily load latest web assets onto the server
*/
module.exports = (serv) => {
  
    serv.get("/api/version", (req, res) => {
        var package_file_path = path.join(__dirname, "..", "package.json");
        var obj = JSON.parse(fs.readFileSync(package_file_path, 'utf8'));
        res.status(200).json({"name":"Lantern (JavaScript)","version": obj.version});
    });

    serv.post("/api/name", bodyParser.json(), (req, res) => {
        var id = util.getDeviceIdentifier();
        if (req.body.name && typeof(req.body.name) == "string") {
            if (req.body.name.length != 3) {
                return res.status(409).json({"ok": false, "message": "Name must be 3 characters in length"});
            }
            log.info("setting name of host to: " + req.body.name);
            
            util.saveDeviceName(req.body.name);

            return res.status(201).json({"ok": true, "id": id, "name": req.body.name});
        }
        else {
            return res.status(409).json({"ok": false, "id": id, "message": "Required parameter not found: name"});
        }
    });


    serv.get("/api/info", (req, res) => {
        var id = util.getDeviceIdentifier();
        util.getDeviceName().then(function(name) {
            res.status(200).send({
                "id": id, 
                "name": name,
                "cloud": (process.env.CLOUD == "true")
            });
        });
    });


    serv.get("/api/name", (req, res) => {
        var id = util.getDeviceIdentifier();
        util.getDeviceName().then((name) => {
            res.status(200).send({
                "id": id, 
                "name": name
            });
        });
    });


    serv.get("/api/geo", (req, res) => {
        var id = util.getDeviceIdentifier();
        db.get("d:"+ id)
            .then((doc) => {
                if (doc.gp && doc.gp.length) {
                    res.status(200).send({"id":id, "geo": doc.gp[doc.gp.length-1]});
                }
                else {
                    // return most recent geolocation
                    res.status(200).send({"id":id, "geo": null});
                }
            })
            .catch((err) => {
                log.error(err);
                res.status(500).send();
            });
    });

    serv.post("/api/geo", bodyParser.json(), (req, res) => {
        var id = util.getDeviceIdentifier();
        if (req.body.geo && typeof(req.body.geo) == "string") {
            util.saveDeviceLocation(req.body)
                .then(() => {
                    res.status(201).send({"ok": true, "id": id, "geo": req.body.geo});
                });
        }        
        else {
            return res.status(409).json({"ok": false, "id": id, "message": "Required parameter not found: geo"});
        }
    });


    serv.get("/api/id", (req, res) => {
        res.status(200).send({"id": util.getDeviceIdentifier()});
    });


    serv.post("/api/ui", (req, res) => {
        require("../bin/load-apps")(() => {
            res.status(201).json({"ok": true});
        });
    });
};