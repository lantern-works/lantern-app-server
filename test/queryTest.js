process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const should = require('should')
const fetch = require('node-fetch')
const conf = require('./testConf')

describe('query', () => {
    
    const putMessage = (data) => {
        return fetch(conf.URI + '/api/inbox', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
    }

    it('should send', (done) => {
        putMessage({ 'message': `${conf.DEVICE}>>default@0.0.1::0::0`})
            .then(response => response.json())
            .then((json) => {
                json.ok.should.equal(true)
                done()
            })
    })
})