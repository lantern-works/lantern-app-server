process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const should = require('should')
const fetch = require('node-fetch')
const conf = require('./testConf')

describe('outbox', () => {
    const putMessage = (data) => {
        return fetch(conf.URI + '/api/outbox', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
    }

    it('should ignore empty message', (done) => {
        putMessage({ 'no': 'message' })
            .then(response => response.json())
            .then((json) => {
                json.ok.should.equal(false)
                done()
            })
    })

    it('should discard a malformed message', (done) => {
        putMessage({ 'message': 'bad message!!' })
            .then(response => response.json())
            .then((json) => {
                json.ok.should.equal(false)
                done()
            })
    })

    it('should queue a well-formed update message', (done) => {
        putMessage({ 'message': `2^test.me=yes` })
            .then(response => response.json())
            .then((json) => {
                json.ok.should.equal(true)
                done()
            })
    })

    it('should queue a well-formed drop message', (done) => {
        putMessage({ 'message': `3-test` })
            .then(response => response.json())
            .then((json) => {
                json.ok.should.equal(true)
                done()
            })
    })

    it('should list outbox', (done) => {
        fetch(conf.URI + '/api/outbox', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        })
            .then(response => response.json())
            .then((json) => {
                console.log(json.messages)
                done()
            })
    })

    after((done) => {
        fetch(conf.URI + '/api/outbox', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        })
            .then(response => response.json())
            .then((json) => {
                console.log('got item from outbox queue:', json)
                should.exist(json.message)
                json.rows.should.be.aboveOrEqual(1)
                done()
            })
    })
})
