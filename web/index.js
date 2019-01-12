"use strict"

/**
* Lantern HTTP Server
*
* We serve web logic with Express and the database at the same origin.
* This allows easy access to the database through javascript.
* Useful for hosting on a Raspberry Pi or cloud environment.
*
**/



//----------------------------------------------------------------------
const fs = require("fs-extra");
const path = require("path");
fs.ensureDirSync(path.resolve(__dirname, "../logs"));
fs.ensureDirSync(path.resolve(__dirname, "../db"));
fs.ensureDirSync(path.resolve(__dirname, "../tiles"));



//----------------------------------------------------------------------
const http = require("http");
const https = require("https");
const GraphDB = require("gun")
const util = require("./util");
const app = require("./server")
const watch = require("./watcher");
const log = util.Logger;



//----------------------------------------------------------------------------
log.setLevel(process.env.LOG_LEVEL || "debug");
log.info("##############################################");
log.info("Lantern App Server");
log.info("##############################################");



//----------------------------------------------------------------------------

let secure_server = null;
try {
	// read in ssl certificate data
	let private_key_path = process.env.SSL_PRIVATE_KEY || path.resolve(__dirname, "../certs/dev.lantern.link-key.pem");
	let certificate_path = process.env.SSL_CERTIFICATE || path.resolve(__dirname, "../certs/dev.lantern.link.pem");
	let credentials = {
		key: fs.readFileSync(private_key_path, 'utf8'), 
		cert: fs.readFileSync(certificate_path, 'utf8')
	};
	secure_server = https.createServer(credentials, app);
}
catch(e) {
	if (e.code == "ENOENT") {
		log.error(`SSL certificates not found in "certs" directory...`);
	}
	else {
		log.error(e);
	}
}


// start the web server with built-in database solution
let http_server = http.createServer(app);

let std_server = http_server.listen(util.getHttpPort(), () => {


	let db_path = path.resolve(__dirname, "../db/dev");
	if (process.env.DB) {
		db_path = path.resolve(__dirname, "../" + process.env.DB);
	}

	let db = GraphDB({
		file: db_path, 
		web: secure_server || std_server
	});


	log.info(`database path = ${db_path}`);
	
	if (secure_server) {
		let secure_web = secure_server.listen(util.getHttpsPort());
		log.info(`secure port = ${util.getHttpsPort()}`);
	}
	else {
		log.warn("falling back to http for local development...");
		log.info(`standard port = ${util.getHttpPort()}`);
	}

	watch(db);
});
