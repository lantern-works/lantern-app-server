"use strict";
const LX = window.LX || {}; if (!window.LX) window.LX = LX;


LX.PieMenu = class PieMenu extends LV.EventEmitter {

    constructor() {
        super();
        this._locked = false;
        this._open = false;
        this.wheel = null;
        this.element = document.getElementById("pie-menu");
        this.mask_element = document.getElementById("pie-menu-mask");
        this.mask_element.onclick = () => {
            this.close();
            this.unlock();
        };
    }    

    /**
    * Display menu on canvas on top of a mask
    */
    open(items, pos) {
        if (!items || !items.length) {
            return console.log("[PieMenu] Refusing to show menu with zero items");
        }

        if (this._locked) {
            return console.log("[PieMenu] Refusing to open while menu is in locked state");
        }
        else {
            //console.log("[PieMenu] Open");
        }


        // create icons for menu
        let final_items = [];

        items.forEach((item) => {
            if (item.icon) {
                let icon = "imgsrc:/_/@fortawesome/fontawesome-free/svgs/solid/" + item.icon + ".svg";
                final_items.push(icon);                
            }
            else if (item.label) {
                final_items.push(item.label);
            }
        });

        // create wheel menu
        this.wheel = new wheelnav("pie-menu");
        this.wheel.titleWidth = 22;
        this.wheel.navAngle = 30;
        this.wheel.wheelRadius = 100;
        this.wheel.selectedNavItemIndex = null;;
        this.wheel.createWheel(final_items);

        let fired_events = {};

        // define custom methods to handle menu selection
        this.wheel.navItems.forEach((item) => {

            item.navigateFunction = () => {
                let matched_item = items[item.itemIndex];
                let event_data = null;
                if(matched_item.method) {
                    event_data = matched_item.method();
                }
                this.close.call(this);  

                if (matched_item.event && !fired_events.hasOwnProperty(matched_item.event)) {
                    this.emit(matched_item.event, event_data);
                    fired_events[matched_item.event] = true;
                }
            }
        });

        // create mask for behind the menu
        this.mask_element.classList = "active";

        // set x/y location for pie menu
        if(pos.x && pos.y) {
            let svg = this.element.childNodes[0];
            let width = svg.width.baseVal.valueAsString;
            let height = svg.height.baseVal.valueAsString;
            this.element.style.left = (pos.x - width/2)+"px";
            this.element.style.top = (pos.y - height/2)+"px";
        }

        this.element.classList = "active";
        this._open = true;
        this.emit("open");
    }
    
    /**
    * Hide menu from canvas and remove mask
    */
    close() {
        //console.log("[PieMenu] Close");
        this.element.classList.remove("active")
        this.mask_element.classList.remove("active");
        this._open = false;
        this.emit("close");
    }

    isOpen() {
        return this._open;
    }


    lock() {
        this._locked = true;
        //console.log("[PieMenu] Lock");
        this.emit("lock");
    }

    unlock() {
        this._locked = false;

        //console.log("[PieMenu] Unlock");
        // handle mobile double-activate bug
        setTimeout(() => {
            this.emit("unlock");
        }, 400);
    }

    isLocked() {
        return this._locked;
    }
}