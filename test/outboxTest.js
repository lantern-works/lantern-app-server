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
        let s = Math.random().toFixed(2)
        putMessage({ 'message': `demo@0.0.1::3::13|jsu5eoqr4NPZaLoqApNb^s=${s}` })
            .then(response => response.json())
            .then((json) => {
                json.ok.should.equal(true)
                done()
            })
    })
    it('should queue a message with lots of spaces', (done) => {
        let s = Math.random().toFixed(2)
        putMessage({ 'message': `demo@0.0.1::3::13|jsu5eoqr4NPZaLoqApNb^s=${s}&l=Nullam quis risus eget urna mollis ornare vel eu leo. Vivamus sagittis lacus vel augue laoreet rutrum faucibus dolor auctor. Integer posuere erat a ante venenatis dapibus posuere velit aliquet. Cras mattis consectetur purus sit amet fermentum. Vestibulum id ligula porta felis euismod semper. Integer posuere erat a ante venenatis dapibus posuere velit aliquet. Duis mollis, est non commodo luctus, nisi erat porttitor ligula, eget lacinia odio sem nec elit. Donec id elit non mi porta gravida at eget metus. Cras mattis consectetur purus sit amet fermentum. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Nulla vitae elit libero, a pharetra augue. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Etiam porta sem malesuada magna mollis euismod.

Donec id elit non mi porta gravida at eget metus. Maecenas sed diam eget risus varius blandit sit amet non magna. Duis mollis, est non commodo luctus, nisi erat porttitor ligula, eget lacinia odio sem nec elit. Vestibulum id ligula porta felis euismod semper. Nullam quis risus eget urna mollis ornare vel eu leo. Sed posuere consectetur est at lobortis. Vivamus sagittis lacus vel augue laoreet rutrum faucibus dolor auctor.

Cras mattis consectetur purus sit amet fermentum. Nullam quis risus eget urna mollis ornare vel eu leo. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Donec id elit non mi porta gravida at eget metus. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Praesent commodo cursus magna, vel scelerisque nisl consectetur et. Vivamus sagittis lacus vel augue laoreet rutrum faucibus dolor auctor.

Morbi leo risus, porta ac consectetur ac, vestibulum at eros. Maecenas sed diam eget risus varius blandit sit amet non magna. Maecenas sed diam eget risus varius blandit sit amet non magna. Sed posuere consectetur est at lobortis. Aenean eu leo quam. Pellentesque ornare sem lacinia quam venenatis vestibulum. Nullam quis risus eget urna mollis ornare vel eu leo. Praesent commodo cursus magna, vel scelerisque nisl consectetur et.` })
            .then(response => response.json())
            .then((json) => {
                json.ok.should.equal(true)
                done()
            })
    })


    it('should queue a well-formed drop message', (done) => {
        putMessage({ 'message': `demo@0.0.1::3::13|test-` })
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
