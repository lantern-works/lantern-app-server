const EventEmitter = require('event-emitter-es6')
const Vue = require('vue')

module.exports = class App extends EventEmitter {
    constructor (obj, data, context) {
        super()
        this.context = context
        this.name = obj.name
        this.css_id = `lx-app-${this.name}-css`
        this.children = obj.children
        this.pages = []
        this._component_opened = {}
        this.data = data || {}
        this.load()
    }

    // ------------------------------------------------------------------------
    createPageComponent (pageID, body, logic) {
        let cmp = {
            template: body
        }

        let componentID = ['lx', 'app', this.name, pageID].join('-')

        let self = this

        let page = {
            'id': pageID,
            'componentID': componentID,
            'app': this
        }
        if (logic) {
            if (logic.data) {
                // keep multiple components in same app together with same data
                Object.keys(logic.data).forEach(key => {
                    self.data[key] = logic.data[key]
                })
                cmp.data = function () {
                    return self.data
                }
            }

            if (logic.computed) {
                cmp.computed = logic.computed
            }
            if (logic.methods) {
                cmp.methods = {}
                for (var idx in logic.methods) {
                    cmp.methods[idx] = logic.methods[idx]
                }
            }
            if (logic.mounted) {
                cmp.mounted = logic.mounted
            }
        }

        page.component = Vue.component(componentID, cmp)

        self.pages.push(page)

        self.emit('load', page)

        if (logic) {
            if (logic.callback) {
                logic.callback(page)
            }
            if (logic.open) {
                self.open(componentID)
            }
        }
    }

    get logPrefix () {
        return `[a:lx-app-${this.name}]`.padEnd(20, ' ')
    }

    // ------------------------------------------------------------------------
    /**
    * Setup the VueComponent with logic as defined by developer
    */
    load () {
        let accepted = ['data', 'computed', 'methods', 'open', 'callback', 'mounted']
        let imageRegex = /(<img[\S\s]*?src=")([\S\s]*?)("[\S\s]*?>)/ig
        let logic = {}
        try {
            this.children.forEach((child) => {
                if (child.extension === '.css' && child.body) {
                    this.addCSS(child.body)
                } else if (child.extension === '.js' && child.body) {
                    let js = eval(child.body)
                    accepted.forEach((key) => {
                        if (js.hasOwnProperty(key)) {
                            logic[key] = js[key]
                        }
                    })
                }
            })
            this.children.forEach((child) => {
                if (child.extension === '.html' && child.body) {
                    let html = child.body.replace(imageRegex, '$1' + `/-/${this.name}/` + '$2$3')
                    let pageID = child.name.split('.')[0]
                    this.createPageComponent(pageID, html, logic)
                }
            })
        } catch (e) {
            console.warn(`${this.logPrefix} failed to load application`)
            console.error(e)
        }
    }

    /**
    * Removes all Vue components and related code and style injection
    */
    unload () {
        this.pages.forEach((page) => {
            this.close(page.componentID)
        })
        setTimeout(() => {
            // allows vue to clear DOM to avoid flashes of content
            this.removeCSS()
        }, 300)
    }

    // ------------------------------------------------------------------------
    /**
    * Displays Vue component on the screen
    */
    open (componentID) {
        if (this._component_opened[componentID]) {
            // skip already opened app
            return
        }
        this._component_opened[componentID] = true
        //console.log(`${this.logPrefix} open ${componentID}`);
        this.emit('open', componentID)
    }

    /**
    * Hides Vue component but keeps style injection for other open components
    */
    close (componentID) {
        this._component_opened[componentID] = false
        //console.log(`${this.logPrefix} close ${componentID}`);
        this.emit('close', componentID)
    }

    /**
    * Checks whether this app is open
    */
    isOpen () {
        return this._opened
    }

    // ------------------------------------------------------------------------
    /**
    * Inject CSS into DOM, allowing apps to redefine global styles if needed
    */
    addCSS (css) {
        let head = document.getElementsByTagName('head')[0]
        let s = document.createElement('style')
        s.setAttribute('type', 'text/css')
        s.id = this.css_id
        if (s.styleSheet) { // IE
            s.styleSheet.cssText = css
        } else { // the world
            s.appendChild(document.createTextNode(css))
        }
        head.appendChild(s)
    }

    removeCSS () {
        let s = document.getElementById(this.css_id)
        if (s) {
            s.parentNode.removeChild(s)
        }
    }
}
