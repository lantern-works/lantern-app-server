process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const should = require('should')
const fetch = require('node-fetch')
const conf = require('./testConf')

describe('platform', function () {
    // @todo make this go .. faster...
    this.timeout(6000)
    it('should compress and minify platform code', (done) => {
        fetch(conf.URI + '/api/platform', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        })
            .then(response => response.json())
            .then((json) => {
                json.ok.should.equal(true)
                done()
            })
    })
})
