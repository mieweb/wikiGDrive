// https://vitepress.dev/guide/custom-theme
import Layout from './Layout.vue';
import type { Theme } from 'vitepress'
import './style.css'
import * as VueRouter from 'vue-router';

const vueRouter = VueRouter.createRouter({
  history: VueRouter.createMemoryHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      //component: () => import('./StaticView.vue')
       children: []
      // component: () => import('./pages/StaticView.vue')
    },
    // {
    //   path: '/:pathMatch(.*)*',
    //   name: 'NotFound',
    //   component: () => import('./StaticView.vue')
    // }
]});

export default {
  Layout,
  enhanceApp({ app, router, siteData }) {
   app.use(vueRouter);
  }
} satisfies Theme;
