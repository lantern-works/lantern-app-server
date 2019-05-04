process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const should = require('should')
const fetch = require('node-fetch')
const conf = require('./testConf')

describe('outbox', () => {
    it('should send a message', (done) => {
        this.timeout = 3000
        let data = {
            'command': 'test'
        }
        fetch(conf.URI + '/api/command', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
            .then(response => { return response.json() })
            .then(json => {
                json.ok.should.equal(true)
                done()
            })
    })
})
