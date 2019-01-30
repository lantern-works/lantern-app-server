const EventEmitter = require('event-emitter-es6')
require('wheelnav')
const WheelNav = window.wheelnav

module.exports = class Menu extends EventEmitter {
    constructor () {
        super()
        this._locked = false
        this._open = false
        this.wheel = null
        this.element = document.getElementById('pie-menu')
        this.mask_element = document.getElementById('pie-menu-mask')
        if (!this.element || !this.mask_element) {
            return console.error('[PieMenu] Missing required pie menu element in HTML')
        }
        this.mask_element.onclick = () => {
            this.close()
            this.unlock()
        }
    }

    /**
    * Display menu on canvas on top of a mask
    */
    open (items, pos) {
        if (!items || !items.length) {
            return console.warn('[PieMenu] Refusing to show menu with zero items')
        }

        if (this._locked) {
            return console.log('[PieMenu] Refusing to open while menu is in locked state')
        } else {
            // console.log("[PieMenu] Open");
        }

        // create icons for menu
        let finalitems = []

        items.forEach((item) => {
            if (item.icon) {
                let icon = 'imgsrc:/icons/' + item.icon + '.svg'
                finalitems.push(icon)
            } else if (item.label) {
                finalitems.push(item.label)
            }
        })

        // create wheel menu
        this.wheel = new WheelNav('pie-menu')
        this.wheel.titleWidth = 22
        this.wheel.navAngle = 30
        this.wheel.wheelRadius = 100
        this.wheel.selectedNavItemIndex = null
        this.wheel.createWheel(finalitems)

        let fireEvents = {}

        // define custom methods to handle menu selection
        this.wheel.navItems.forEach((item) => {
            item.navigateFunction = () => {
                let matchedItem = items[item.itemIndex]
                let eventData = null
                if (matchedItem.method) {
                    eventData = matchedItem.method()
                }
                this.close()

                if (matchedItem.event && !fireEvents.hasOwnProperty(matchedItem.event)) {
                    this.emit(matchedItem.event, eventData)
                    fireEvents[matchedItem.event] = true
                }
            }
        })

        // create mask for behind the menu
        this.mask_element.classList = 'active'

        // set x/y location for pie menu
        if (pos.x && pos.y) {
            let svg = this.element.childNodes[0]
            let width = svg.width.baseVal.valueAsString
            let height = svg.height.baseVal.valueAsString
            this.element.style.left = (pos.x - width / 2) + 'px'
            this.element.style.top = (pos.y - height / 2) + 'px'
        }

        this.element.classList = 'active'
        this._open = true
        this.emit('open')
    }

    /**
    * Hide menu from canvas and remove mask
    */
    close () {
        // console.log("[PieMenu] Close");
        this.element.classList.remove('active')
        this.mask_element.classList.remove('active')
        this._open = false
        this.emit('close')
    }

    isOpen () {
        return this._open
    }

    lock () {
        this._locked = true
        // console.log("[PieMenu] Lock");
        this.emit('lock')
    }

    unlock () {
        // console.log("[PieMenu] Unlock");
        // handle mobile double-activate bug
        setTimeout(() => {
            this._locked = false
            this.emit('unlock')
        }, 400)
    }

    isLocked () {
        return this._locked
    }
}
