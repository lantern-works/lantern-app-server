"use strict";
const LX = window.LX || {}; if (!window.LX) window.LX = LX;
const LV = window.LV || {}; if (!window.LV) window.LV = LV;



//----------------------------------------------------------------------------
const elliptic = require("elliptic");
const Mnemonic = require("mnemonic.js");
const shortHash = require("short-hash");

LX.Profile = class Profile extends LV.EventEmitter {

    constructor(skip_check) {

        super();

        this.db = new LV.PouchDB("lx-user");


        if (skip_check) {
            console.log("[Profile] Making a new profile by explicit request")
            this.generate();
        }
        else {
            // check browser for known profile for this user
            this.db.get("profile")
                .then((profile) => {
                    let requirements = ["mnemonic", "address", "public_key", "private_key"];
                    let is_valid = true;
                    requirements.forEach((key) =>  {
                        if (!profile.hasOwnProperty(key)) {
                            is_valid = false;
                            console.log("[Profile] Existing saved profile missing required key: " + key);
                        }
                    });
                    if (is_valid) {
                        console.log("[Profile] Known profile from storage: " + profile.address);
                        requirements.forEach((key) =>  {
                            this[key] = profile[key];
                        });
                        this.emit("load");
                    }
                    else {
                        console.log("[Profile] Removing invalid profile from storage");
                        this.db.remove(profile).then(() => { 
                            this.generate();
                        });
                    }
                })
                .catch((e) => {
                    if (e.name == "not_found") {
                        this.generate();
                    }
                    else {
                        console.log("[Profile] Error getting profile", e);
                    }
                });
        }
    }

    generate() {
        console.log("[Profile] Generate")
        var m;
        const ec = new elliptic.ec('secp256k1');
        // deterministic public / private keys plus handles based on words
        if (typeof(secret) == "object") {
            m = Mnemonic.fromWords(secret);
        }
        else if (typeof(secret) == "string") {
            this.public_key = secret;
        }
        else {
            m = new Mnemonic(64);
        }
        
        if (m) {
            // keep words for user backup
            this.mnemonic = m.toWords();

            // define private key based on mnemonic
            this.private_key = m.toHex();
                
            // http://procbits.com/2013/08/27/generating-a-bitcoin-address-with-javascript
            var public_point = ec.keyFromPrivate(this.private_key).getPublic();

            // create public address based on key pair
            this.public_key = public_point.encodeCompressed("hex");
        }

        this.address = shortHash(this.public_key);
    }

    save() {
        let doc = {
            "_id" : "profile",
            "mnemonic": this.mnemonic,
            "address": this.address,
            "public_key": this.public_key,
            "private_key": this.private_key 
        }
        this.db.put(doc)
            .then(() => {
                console.log("[Profile] Saved to browser");
                this.emit("load");
            })
            .catch((e) => {
                console.log("[Profile] Unable to save", e);
            });
    }
}



//----------------------------------------------------------------------------
// all required items are loaded in by now. time to start everything up...
window.LT = new LX.Director();