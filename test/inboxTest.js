process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const should = require('should')
const fetch = require('node-fetch')
const conf = require('./testConf')

describe('inbox', () => {
    const putMessage = (data) => {
        return fetch(conf.URI + '/api/inbox', {
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


    it('should accept a key for unknown and then known item', (done) => {
        putMessage({ 'message': `1^test.me=yes` })
            .then(response => response.json())
            .then((json) => {
                json.ok.should.equal(true)
            })
            .then(() => {
                putMessage({ 'message': `2^test.me=again` })
                .then(response => response.json())
                .then((json) => {
                    json.ok.should.equal(true)
                    done()
                })
            })
    })


    after((done) => {
        // clean up the existing node we created
        putMessage({ 'message': `3-test` })
            .then(response => response.json())
            .then((json) => {
                json.ok.should.equal(true)
                // lists past messages from inbox
                fetch(conf.URI + '/api/inbox', {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                })
                    .then(response => response.json())
                    .then((json) => {
                        json.messages.length.should.be.aboveOrEqual(3)
                        console.log(json.messages)
                        done()
                    })
            })
    })
})
