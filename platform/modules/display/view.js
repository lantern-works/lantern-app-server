LX.View = class View extends LV.EventEmitter {

    constructor() {
        super();
        // setup vue object
        LV.Vue.filter('pluralize', (word, amount) => amount != 1 ? `${word}s` : word)
        this.vue = new LV.Vue({
            el: '#app-container',
            data: {
                app_components: [],
                map: false
            }
        });
        this.data = this.vue.$data;
        this.menu = new LX.PieMenu();
    }
}