process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const should = require('should')
const fetch = require('node-fetch')
const conf = require('./testConf')

describe('info', () => {
    it('should get expected data', (done) => {
        fetch(conf.URI + '/api/info', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        })
            .then(response => { return response.json() })
            .then(json => {
                console.log(json)
                done()
            })
    })
})
