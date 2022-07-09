'use strict';

import {FileClientService} from './services/FileClientService.mjs';
import {DriveClientService} from './services/DriveClientService.mjs';
import {GitClientService} from './services/GitClientService.mjs';

const {loadModule} = window['vue3-sfc-loader'];

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
    };
  },
  addStyle(textContent) {
    const style = Object.assign(document.createElement('style'), {textContent});
    const ref = document.head.getElementsByTagName('style')[0] || null;
    document.head.insertBefore(style, ref);
  }
};

const app = Vue.createApp({
  data: {
    drive: {},
    jobs: []
  },
  components: {
    'App': Vue.defineAsyncComponent(() => loadModule('/assets/App.vue', options))
  },
  template: '<App />',
  methods: {
    async changeDrive(toDriveId) {
      this.drive = await vm.DriveClientService.changeDrive(toDriveId, vm);
    },
    setJobs(jobs) {
      this.jobs = jobs;
    }
  }
});

app.mixin({
  data() {
    return {
      DriveClientService: new DriveClientService(),
      FileClientService: new FileClientService(),
      GitClientService: new GitClientService()
    }
  }
});

const router = new VueRouter.createRouter({
  history: VueRouter.createWebHistory(),
  routes: [
    {
      path: '/drive/',
      name: 'drives',
      component: Vue.defineAsyncComponent(() => loadModule('/assets/pages/DrivesView.vue', options)),
    },
    {
      path: '/drive/:driveId*',
      name: 'drive',
      component: Vue.defineAsyncComponent(() => loadModule('/assets/pages/FolderView.vue', options))
    },
    {
      path: '/gdocs/:driveId/:fileId',
      name: 'gdocs',
      component: Vue.defineAsyncComponent(() => loadModule('/assets/pages/GDocsView.vue', options))
    },
    {
      path: '/logs',
      name: 'logs',
      component: Vue.defineAsyncComponent(() => loadModule('/assets/pages/LogsView.vue', options))
    },
    {
      path: '/',
      component: Vue.defineAsyncComponent(() => loadModule('/assets/pages/MainView.vue', options))
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'NotFound',
      component: Vue.defineAsyncComponent(() => loadModule('/assets/pages/NotFound.vue', options))
    }
  ]
});


app.use(router);

const vm = app.mount('#app');

router.beforeEach(async (to, from) => {
  const toDriveId = Array.isArray(to.params?.driveId) ? to.params.driveId[0] : to.params.driveId;
  const fromDriveId = Array.isArray(from.params?.driveId) ? from.params.driveId[0] : from.params.driveId;
  if (toDriveId !== fromDriveId) {
    await vm.changeDrive(toDriveId);
  }
});
