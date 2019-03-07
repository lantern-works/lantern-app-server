/**
* Lantern Database Watcher
* 
* Use this to update hardware or connect to other services each time changes are made locally. Batches changes 
* per-package and issues a signal every few seconds and will run any specificed change hook binary
*/
const util = require('./util')
const log = util.Logger
const path = require('path')
const execFile = require('child_process').execFile

module.exports = (app) => {
    let loaded = false
    let hook = null
    let node = app.locals.db.get('__LX__').get('pkg')
    let packages = {}
    let items = {}

    // ----------------------------------------------------------------------
    /**
    * Watch for and announce changes to given package
    */
    const watchPackage = (v, k) => {

        if (!v) {
            // package deleted, ignore...
            return
        }

        if (!v.name || !v.version) {
            log.warn(`${util.logPrefix('watcher')} missing name or version for package ${k}: `, v)
            return
        }


        let packageID = [k, v.version].join('@')


        if (packages.hasOwnProperty(packageID)) {
            //log.debug(`${util.logPrefix(packageID)} skip duplicate...`)
            return
        }

        log.debug(`${util.logPrefix(packageID)} begin watching...`)
        packages[packageID] = {}

        let subnode = node.get(k).get('data').get(v.version)
        subnode.map()
            .on((v, k) => {
                markItemAsChanged(subnode, packageID, v, k)
            })
    }

    /**
    * Watch for and announce changes to given item
    */
    const markItemAsChanged = (subnode, packageID, itemData, itemID) => {
        // detected drop
        if (itemData === null) {
            // this can be triggered when an item is first created due to the way we use put(null)
            // therefore, only indicate deletions if we already know about a valid item
            if (loaded && items[itemID]) {
                markItemAsDropped(packageID, itemID)
            }
            return
        }

        // prevent duplicate runs
        if (items[itemID]) return
        items[itemID] = true

        // watch for field changes
        subnode.get(itemID)
            .map().on((fieldData, fieldID) => {
                // @todo identify issue where inbox can trigger this code
                // to run twice for the same database update
                if (loaded) {
                    markItemAsUpdated(packageID, itemID, fieldID, fieldData)
                }
            })
    }

    const markItemAsDropped = (packageID, itemID) => {
        packages[packageID] = packages[packageID] || {}
        packages[packageID][itemID] = null
    }

    const markItemAsUpdated = (packageID, itemID, fieldID, fieldData) => {
        packages[packageID] = packages[packageID] || {}
        packages[packageID][itemID] = packages[packageID][itemID] || {}
        packages[packageID][itemID][fieldID] = fieldData
    }

    const init = () => {
        //log.debug(`${util.logPrefix('watcher')} waiting for changes...`)
        loaded = true

        // check to see if we have a change hook from environment
        if (process.env.hasOwnProperty('HOOK_CHANGE')) {
            hook = path.resolve(process.env['HOOK_CHANGE'])
            let timing = (process.env.CHANGE_INTERVAL ? Number(process.env.CHANGE_INTERVAL) : 5000)
            //log.debug(`${util.logPrefix('watcher')} change hook = ${hook} (${timing}ms)`)
            setInterval(
                runHook, 
                timing
            )
        }
    }

    const runHook = (key) => {

        let changes = {}
        Object.keys(packages).forEach((packageID) => {
            if (Object.keys(packages[packageID]).length) {
                changes[packageID] = packages[packageID]
                packages[packageID] = {}
            }
        })

        if (!Object.keys(changes).length) {
            //log.debug(`skip hook since no data change`)
            return
        }

        let changeString = JSON.stringify(changes)

        try {
            let ps = execFile(hook, [changeString])
            ps.stdout.on('data', (data) => {
                // if we got confirmation back, we can clear our queue
                 log.debug(`${util.logPrefix('change')} ${data}`)
            })
            ps.stderr.on('data', (err) => {
                log.warn(`hook could not run: ${err}`)
            })
        } catch (e) {
            log.warn(`hook could not run: ${hook}`)
            log.warn('is the hook executable?')
            log.error(e)
        }
    }

    // ----------------------------------------------------------------------
    // identify and prepare to watch all valid packages in the database
    node.map().on(watchPackage)
    node.once((v, k) => {
        // don't output initial data load
        setTimeout(init, 300)
    })
}
