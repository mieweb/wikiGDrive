'use strict';

import {AuthenticatedClient} from "./services/AuthenticatedClient.mjs";
import {FileClientService} from './services/FileClientService.mjs';
import {DriveClientService} from './services/DriveClientService.mjs';
import {GitClientService} from './services/GitClientService.mjs';
import {SearchClientService} from './services/SearchClientService.mjs';

import * as Vue from 'vue';
import * as VueRouter from 'vue-router';
import mitt from 'mitt';

import App from './App.vue';
import {ModalsMixin} from './modals/ModalsMixin.mjs';
import {ToastsMixin} from './modals/ToastsMixin.mjs';
import {CachedFileClientService} from './services/CachedFileClientService.mjs';

function completedJob(job) {
  return !['waiting', 'running'].includes(job.state);
}

const emitter = mitt();

const app = Vue.createApp({
  data: {
    drive: {},
    jobs: [],
    jobsMap: {},
    changes: [],
    changesMap: {}
  },
  components: {
    'App': App
  },
  mixins: [ModalsMixin, ToastsMixin],
  template: '<App />',
  computed: {
    gitStats() {
      return Object.assign({
        initialized: false,
        remote_url: ''
      }, this.drive.gitStats);
    }
  },
  created() {
    this.authenticatedClient.app = this.$root;
    this.emitter.on('*', (type) => {
      switch (type) {
        case 'render_preview:done':
        case 'git_pull:done':
        case 'git_push:done':
        case 'commit:done':
          this.FileClientService.clearCache();
          if (this.drive?.id) {
            this.changeDrive(this.drive.id);
          }
          this.emitter.emit('tree:changed');
          break;
      }
    });
  },
  methods: {
    async changeDrive(toDriveId) {
      try {
        this.drive = await vm.DriveClientService.changeDrive(toDriveId, vm);
        const titleEl = document.querySelector('title');
        if (titleEl) {
          if (this.drive?.name) {
            titleEl.innerText = this.drive?.name + ' - wikigdrive';
          } else {
            titleEl.innerText = 'wikigdrive';
          }
        }
      } catch (err) {
        this.drive = {
          share_email: err.share_email,
          id: toDriveId,
          notRegistered: true
        };
      }
    },
    setJobs(jobs) {
      this.jobs = jobs;
      this.jobsMap = {};
      for (const job of jobs) {
        if (completedJob(job)) {
          continue;
        }

        if (job.type === 'sync_all') {
          this.jobsMap['sync_all'] = job;
          continue;
        }
        if (job.type === 'transform') {
          this.jobsMap['transform'] = job;
          continue;
        }
        if (!job.payload) {
          continue;
        }
        this.jobsMap[job.payload] = job;
      }
    },
    setChanges(changes) {
      this.changes = changes;
      this.changesMap = {};
      for (const change of changes) {
        this.changesMap[change.id] = change;
      }
    }
  }
});

app.directive('grow', {
  mounted(el, binding, vnode) {
    el.rows = null;
    el.style.resize = 'none';
    el.style.minHeight = '50px';
    setTimeout(() => {
      el.style.height = (el.scrollHeight + 2)+'px';
    }, 10);
    setInterval(() => {
      el.style.height = (el.scrollHeight + 2)+'px';
    }, 1000);
  },
  updated() {
    console.log('updated');
  },
  deep: true
});

const authenticatedClient = new AuthenticatedClient(null);

app.config.globalProperties.emitter = emitter;
app.config.globalProperties.authenticatedClient = authenticatedClient;
app.config.globalProperties.DriveClientService = new DriveClientService(authenticatedClient);
app.config.globalProperties.FileClientService = new CachedFileClientService(authenticatedClient);
app.config.globalProperties.GitClientService = new GitClientService(authenticatedClient);
app.config.globalProperties.SearchClientService = new SearchClientService(authenticatedClient);

const router = new VueRouter.createRouter({
  history: VueRouter.createWebHistory(),
  routes: [
    {
      path: '/drive/',
      name: 'drives',
      component: () => import('./pages/DrivesView.vue'),
    },
    {
      path: '/drive/:driveId*',
      name: 'drive',
      component: () => import('./pages/FolderView.vue')
    },
    {
      path: '/gdocs/:driveId/:fileId',
      name: 'gdocs',
      component: () => import('./pages/GDocsView.vue')
    },
    {
      path: '/logs',
      name: 'logs',
      component: () => import('./pages/LogsView.vue')
    },
    {
      path: '/',
      name: 'home',
      component: () => import('./pages/MainView.vue')
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'NotFound',
      component: () => import('./pages/NotFound.vue')
    }
  ]
});

app.use(router);

const vm = app.mount('#app');

router.beforeEach(async (to, from, next) => {
  const toDriveId = Array.isArray(to.params?.driveId) ? to.params.driveId[0] : to.params.driveId;
  const fromDriveId = Array.isArray(from.params?.driveId) ? from.params.driveId[0] : from.params.driveId;
  if (toDriveId !== fromDriveId) {
    vm.FileClientService.clearCache();
    await vm.changeDrive(toDriveId);
  }
  next();
});
