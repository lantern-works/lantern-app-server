const yaml = require('node-yaml')
const shortid = require('shortid')
let confPath = '../env/config.yml'

const generateDeviceIdentifier = (conf) => {
    conf.peer = shortid.generate()
    yaml.writeSync(confPath, conf)
    return conf
}

let conf = {}

try {
    conf = yaml.readSync(confPath)
    if (!conf.hasOwnProperty('peer')) {
        conf = generateDeviceIdentifier(conf)
    }
}
catch(e) {
    if (e.code == 'ENOENT') {
        // generate new device identifier and save
        conf = generateDeviceIdentifier(conf)
    }
}

module.exports = conf
