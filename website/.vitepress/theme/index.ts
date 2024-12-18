// https://vitepress.dev/guide/custom-theme
import Layout from './Layout.vue';
import NotFound from './NotFound.vue';
import {Theme} from 'vitepress';
import './style.css'
import * as VueRouter from 'vue-router';

export default {
  Layout,
  NotFound, // 404 handling is broken, don't trust the docs
  enhanceApp({ app, router, siteData }) {
    let history = VueRouter.createMemoryHistory();

    const vueRouter = VueRouter.createRouter({
      history,
      routes: [
        {
          path: '/drive/',
          name: 'drives',
          children: []
        },
        {
          path: '/drive/:driveId*',
          name: 'drive',
          children: []
        },
        {
          path: '/gdocs/:driveId/:fileId',
          name: 'gdocs',
          children: []
        },
        {
          path: '/logs',
          name: 'logs',
          children: []
        },
        {
          path: '/share-drive/:driveId',
          name: 'share-drive',
          children: []
        },
        {
          path: '/',
          name: 'home',
          meta: {
            ssg: true
          },
          children: []
        },
        {
          path: '/docs',
          name: 'docs',
          meta: {
            ssg: true
          },
          children: []
        },
        {
          path: '/docs/:pathMatch(.*)*',
          name: 'docs',
          meta: {
            ssg: true
          },
          children: []
        },
        {
          path: '/:pathMatch(.*)*',
          name: 'NotFound',
          meta: {
            ssg: true
          },
          component: []
        }
      ]
    });

    app.use(vueRouter);

    app.mixin({
      data() {
        return {};
      },
      computed: {
        $route() {
          return {
            path: router.route.path
          }
        }
      }
    });
  }
} satisfies Theme;
