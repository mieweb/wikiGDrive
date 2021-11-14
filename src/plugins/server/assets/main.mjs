'use strict';

const { loadModule } = window['vue3-sfc-loader'];

const options = {
    moduleCache: {
        vue: Vue
    },
    async getFile(url) {
        const res = await fetch(url);
        if (!res.ok)
            throw Object.assign(new Error(res.statusText + ' ' + url), {res});
        return {
            getContentData: asBinary => asBinary ? res.arrayBuffer() : res.text(),
        }
    },
    addStyle(textContent) {
        const style = Object.assign(document.createElement('style'), { textContent });
        const ref = document.head.getElementsByTagName('style')[0] || null;
        document.head.insertBefore(style, ref);
    }
};

const app = Vue.createApp({
    components: {
        'App': Vue.defineAsyncComponent( () => loadModule('./App.vue', options) )
    },
    template: '<App />'
});


const router = new VueRouter.createRouter({
    history: VueRouter.createWebHistory(),
    routes: [
        {
            path: '/file/:id',
            name: 'file',
            component: Vue.defineAsyncComponent( () => loadModule('./FileView.vue', options) )
        },
        {
            path: '/logs',
            name: 'logs',
            component: Vue.defineAsyncComponent( () => loadModule('./LogsView.vue', options) )
        },
        {
            path: '/',
            component: Vue.defineAsyncComponent( () => loadModule('./MainView.vue', options) )
        }
    ]
});

app.use(router);

const vm = app.mount('#app')
