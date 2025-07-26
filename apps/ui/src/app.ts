import * as Vue from 'vue';
import * as VueRouter from 'vue-router';

import App from './App.vue';
import {ModalsMixin} from './modals/ModalsMixin';
import {ToastsMixin} from './modals/ToastsMixin';
import {AuthenticatedClient} from './services/AuthenticatedClient';
import {DriveClientService} from './services/DriveClientService';
import {GitClientService} from './services/GitClientService';
import {SearchClientService} from './services/SearchClientService';
import {CachedFileClientService} from './services/CachedFileClientService';
import {markRaw} from 'vue';
import AuthModal from './components/AuthModal.vue';

function completedJob(job) {
  return !['waiting', 'running'].includes(job.state);
}

const emitter = new EventTarget();

export function createApp() {
  const app: Vue.App = Vue.createSSRApp({
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
        changesMap: {}
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
      emitter.addEventListener('tree:changed', async (event: CustomEvent) => {
        await this.FileClientService.clearCache();
        await this.fetchUser();
      });
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
          const vm = this.$root;

          this.drive = await (<any>vm).DriveClientService.changeDrive(toDriveId, vm);
          if (!import.meta.env.SSR) {
            const titleEl = document.querySelector('title');
            if (titleEl) {
              if (this.drive?.name) {
                titleEl.innerText = this.drive?.name + ' - wikigdrive';
              } else {
                titleEl.innerText = 'wikigdrive';
              }
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

  let history = (import.meta.env.SSR) ? VueRouter.createMemoryHistory() : VueRouter.createWebHistory();

  const router = VueRouter.createRouter({
    history,
    routes: [
      {
        path: '/drive/',
        name: 'drives',
        component: () => import('./pages/DrivesView.vue'),
      },
      {
        path: '/drive/:driveId*',
        name: 'drive',
        meta: {
          requireDriveId: true
        },
        component: () => import('./pages/FolderView.vue')
      },
      {
        path: '/gdocs/:driveId/:fileId',
        name: 'gdocs',
        meta: {
          requireDriveId: true
        },
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
        meta: {
          requireDriveId: true
        },
        component: () => import('./pages/ShareView.vue'),
      },
      {
        path: '/',
        name: 'home',
        meta: {
          ssg: true
        },
        component: () => import('./pages/StaticView.vue')
      },
      {
        path: '/docs',
        name: 'docs',
        meta: {
          ssg: true
        },
        component: () => import('./pages/StaticView.vue')
      },
      {
        path: '/docs/:pathMatch(.*)*',
        name: 'docs',
        meta: {
          ssg: true
        },
        component: () => import('./pages/StaticView.vue')
      },
      {
        path: '/:pathMatch(.*)*',
        name: 'NotFound',
        meta: {
          ssg: true
        },
        component: () => import('./pages/StaticView.vue')
      }
    ]
  });

  app.use(router);

  return {app, router};
}

