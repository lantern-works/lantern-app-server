const yaml = require('node-yaml')
const shortid = require('shortid')
let confPath = '../env/config.yml'

const isPrime = (n) => {
    if (isNaN(n) || !isFinite(n) || n%1 || n<2) return false; 
    if (n%2==0) return (n==2);
    var m=Math.sqrt(n);
    for (var i=3;i<=m;i+=2) {
     if (n%i==0) return false;
    }
    return true;
}


const generateDeviceIdentifier = (conf) => {
    conf.peer = shortid.generate()
    yaml.writeSync(confPath, conf)
    return conf
}


const generatePrimeNumber = (conf) => {
    conf.prime = Math.round(Math.random()*50)
    if (!isPrime(conf.prime)) {
        return generatePrimeNumber(conf)
    }
    yaml.writeSync(confPath, conf)
    return conf
}


let conf = {}

try {
    conf = yaml.readSync(confPath)
    if (!conf.hasOwnProperty('peer')) {
        conf = generateDeviceIdentifier(conf)
    }

    if (!conf.hasOwnProperty('prime')) {
        conf = generatePrimeNumber(conf)
        conf = generatePrimeNumber(conf)
    }

}
catch(e) {
    if (e.code == 'ENOENT') {
        // generate new device identifier and save
        conf = generateDeviceIdentifier(conf)
    }
}

module.exports = conf
