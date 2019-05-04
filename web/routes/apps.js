/**
* App Routes
*
* API to get and refresh custom apps available on this server
**/
const fs = require('fs-extra')
const directoryTree = require('directory-tree')
const path = require('path')
const util = require('../util')
const log = util.Logger
const headers = require('../middleware/headers')

module.exports = (serv) => {
    const appsDir = path.join(__dirname, '..', '..', 'apps')

    // ----------------------------------------------------------------------
    /**
    *  Retrieves available applications from this server
    */
    serv.get('/api/apps', headers, (req, res) => {
        if (!fs.existsSync(appsDir)) {
            return res.status(412).json({
                'ok': false, 'message': 'Missing apps directory'
            })
        }

        let filteredTree = directoryTree(appsDir, { extensions: /\.(html|js|json|css|png|gif|jpg|jpeg)$/ })

        let finalResult = {
            data: {},
            apps: []
        }

        util.removeMeta(filteredTree, 'path')
        let result = (filteredTree.hasOwnProperty('children') ? filteredTree.children : [])

        // which type of files do we read in advance?
        let readBodyFor = ['.js', '.css', '.html']

        result.forEach((resource) => {
            if (resource.type == 'directory' && resource.name[0] !== '.') {
                // app directory
                resource.children.forEach((item) => {
                    if (readBodyFor.indexOf(item.extension) > -1) {
                        item.body = String(fs.readFileSync(appsDir + '/' + resource.name + '/' + item.name))
                    }
                })
                finalResult.apps.push(resource)
            } else if (resource.type == 'file' && resource.extension == '.json') {
                // json data
                try {
                    let data = JSON.parse(String(fs.readFileSync(appsDir + '/' + resource.name)))
                    Object.keys(data).forEach(key => {
                        finalResult.data[key] = data[key]
                    })
                } catch (e) {
                    log.error('unable to parse data.json for apps', e)
                }
            }
        })
        return res.status(200).json(finalResult)
    })
}
