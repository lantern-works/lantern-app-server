"use strict"

/**
* Lantern Utilities
*
*/
const path = require("path");
const fs = require("fs-extra");
const self = {};



//----------------------------------------------------------------------
self.removeMeta = function(obj) {
    for(var prop in obj) {
        if (prop === 'path') {
          delete obj[prop];
        }
        else if (typeof obj[prop] === 'object') {
          this.removeMeta(obj[prop]);
        }
    }
}



//----------------------------------------------------------------------
/**
* Log facility
*/
self.Logger = require("simple-node-logger").createSimpleLogger({
    logFilePath: path.resolve(__dirname, '../logs', 'http.log'),
    dateFormat:'YYYY.MM.DD'
});


/**
* Get HTTP Non-Secure Port
*/
self.getHttpPort = () => {
    return (process.env.TERM_PROGRAM ? 9090 : 80);
}

/**
* Get HTTPS Secure Port
*/
self.getHttpsPort = () => {
    return (process.env.TERM_PROGRAM ? 9443 : 443);
}


/**
* Intended / common domain used even while offline
*/
self.getDomain = () => {
    return "lantern.link";
}


/**
* Check for internet access
*/
self.checkInternet = () =>{
    return new Promise((resolve, reject) => {
        require('dns').lookup('google.com',(err, res) => {
            if (err && err.code == "ENOTFOUND") {
                resolve(false);
            } 
            else if (res.substr(0,4) == "192.") {
                // local IP from router
                resolve(false);
            }
            else {
                resolve(true);
            }
        });
    });
}

/**
* Extract IP address from request object
*/
self.getClientIP = (req) => {
    return req.headers['x-forwarded-for'] || req.connection.remoteAddress;
}

/**
* Check if this is a remote client requesting a resource
*/
self.isRemoteClient = (req) => {
    let ip = self.getClientIP(req);
    return ip && (ip.indexOf("127.0.0.1") === -1);
}



//----------------------------------------------------------------------  
/**
* Display memory usage over time
*/
self.watchMemory = () => {
      setInterval(() =>{
        self.Logger.debug("---");
        let arr = [1, 2, 3, 4, 5, 6, 9, 7, 8, 9, 10];
        arr.reverse();
        let used = process.memoryUsage();
        for (const key in used) {
          self.Logger.debug(key + " "  + Math.round(used[key] / 1024 / 1024 * 100) / 100 + " MB");
        }
        self.Logger.debug("---");
    }, 60*1000*2);
}
  

module.exports = self;