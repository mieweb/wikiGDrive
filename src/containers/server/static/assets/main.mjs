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
        'App': Vue.defineAsyncComponent( () => loadModule('/assets/App.vue', options) )
    },
    template: '<App />'
});

const router = new VueRouter.createRouter({
    history: VueRouter.createWebHistory(),
    routes: [
        {
            path: '/file/:id',
            name: 'file',
            component: Vue.defineAsyncComponent( () => loadModule('/assets/FileView.vue', options) )
        },
        {
            path: '/drive/:driveId',
            name: 'drive',
            component: Vue.defineAsyncComponent( () => loadModule('/assets/FolderView.vue', options) ),
        },
        {
            path: '/drive/:driveId/folder/:folderId/:fileId?',
            name: 'folder',
            component: Vue.defineAsyncComponent( () => loadModule('/assets/FolderView.vue', options) ),
        },
        {
            path: '/logs',
            name: 'logs',
            component: Vue.defineAsyncComponent( () => loadModule('/assets/LogsView.vue', options) )
        },
        {
            path: '/',
            component: Vue.defineAsyncComponent( () => loadModule('/assets/MainView.vue', options) )
        },
        {
            path: '/:pathMatch(.*)*',
            name: 'NotFound',
            component: Vue.defineAsyncComponent( () => loadModule('/assets/NotFound.vue', options) )
        }
    ]
});

app.use(router);

const vm = app.mount('#app')
