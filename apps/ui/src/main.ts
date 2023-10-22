'use strict';

import * as Vue from 'vue';
import * as VueRouter from 'vue-router';
import mitt from 'mitt';

import App from './App.vue';
import {ModalsMixin} from './modals/ModalsMixin';
import {ToastsMixin} from './modals/ToastsMixin';
import {AuthenticatedClient} from './services/AuthenticatedClient';
import {DriveClientService} from './services/DriveClientService';
import {GitClientService} from './services/GitClientService';
import {SearchClientService} from './services/SearchClientService';
import {CachedFileClientService} from './services/CachedFileClientService';
import {addTelemetry} from './telemetry';
import {markRaw} from 'vue';
import AuthModal from './components/AuthModal.vue';
import {Tooltip} from 'bootstrap';

function completedJob(job) {
  return !['waiting', 'running'].includes(job.state);
}

const emitter = mitt();

const initialHtmlContent = document.body.querySelector('.mainbar__content') ? document.body.querySelector('.mainbar__content').innerHTML : '';

const app: Vue.App = Vue.createApp({
  components: {
    'App': App
  },
  mixins: [ModalsMixin, ToastsMixin],
  data() {
    return {
      user: null,
      drive: {},
      jobs: [],
      archive: [],
      jobsMap: {},
      changes: [],
      changesMap: {},
      initialHtmlContent
    };
  },
  template: '<App />',
  computed: {
    gitStats() {
      return Object.assign({
        initialized: false,
        remote_url: ''
      }, this.drive.gitStats);
    }
  },
  async created() {
    this.authenticatedClient.app = this.$root;
    this.emitter.on('*', async (type) => {
      switch (type) {
        case 'run_action:done':
        case 'git_pull:done':
        case 'git_push:done':
        case 'git_reset:done':
        case 'git_commit:done':
          if (this.drive?.id) {
            await this.changeDrive(this.drive.id);
          }
          this.emitter.emit('tree:changed');
          break;
        case 'tree:changed':
          await this.FileClientService.clearCache();
          break;
      }
    });
    await this.fetchUser();
  },
  methods: {
    async fetchUser() {
      try {
        const resUser = await authenticatedClient.fetchApi('/user/me');
        const {user} = await resUser.json();
        this.user = user;
      } catch (err) {
        this.user = null;
      }
    },
    async changeDrive(toDriveId) {
      try {
        this.drive = await (<any>vm).DriveClientService.changeDrive(toDriveId, vm);
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
    setJobs(jobs, archive) {
      this.jobs = jobs;
      this.archive = archive;
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
  },
  errorCaptured(err) {
    if (err['status'] === 401 || err['status'] === 403) {
      const json = err['json'] || {};
      if (json.authPath) {
        this.$addModal({
          component: markRaw(AuthModal),
          props: {
            authPath: json.authPath
          },
        });
        return;
      }
    }
    console.error('errorCaptured', Object.keys(err), err);
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

const router = VueRouter.createRouter({
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
      path: '/share-drive/:driveId',
      name: 'share-drive',
      component: () => import('./pages/ShareView.vue'),
    },
    {
      path: '/',
      name: 'home',
      component: () => import('./pages/StaticView.vue')
    },
    {
      path: '/docs',
      name: 'docs',
      component: () => import('./pages/StaticView.vue')
    },
    {
      path: '/docs/:pathMatch(.*)*',
      name: 'docs',
      component: () => import('./pages/StaticView.vue')
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'NotFound',
      component: () => import('./pages/StaticView.vue')
    }
  ]
});

app.use(router);

app.mixin({
  mounted() {
    new Tooltip(document.body, {
      selector: '[data-bs-toggle=tooltip]'
    });
  },
});

const vm = app.mount('#app');

router.beforeEach(async (to, from, next) => {
  const toDriveId = Array.isArray(to.params?.driveId) ? to.params.driveId[0] : to.params.driveId;
  const fromDriveId = Array.isArray(from.params?.driveId) ? from.params.driveId[0] : from.params.driveId;
  if (toDriveId !== fromDriveId) {
    await (<any>vm).FileClientService.clearCache();
    await (<any>vm).changeDrive(toDriveId);
  }
  next();
});
router.afterEach(() => {
  const elements = document.querySelectorAll('[data-bs-toggle=tooltip]');
  elements.forEach(element => {
    const tooltip = Tooltip.getInstance(element);
    if (tooltip) {
      tooltip.hide();
    }
  });
});

addTelemetry(app);
