<template>
  <nav class="navbar navbar-expand-lg navbar-dark bg-nav">
    <span class="navbar-brand">

      <span v-if="sidebar">
        <a @click.prevent="$emit('collapse')" href="#">
          <i class="fa-solid fa-bars"></i>&nbsp;
        </a>
      </span>
      <span v-if="!isGDocsPreview" class="drive-link">
        <router-link :to="{ name: 'home' }">WikiGDrive</router-link>
      </span>
    </span>
    <slot>
      <ul class="navbar-nav mr-auto align-items-center justify-content-start">
        <li class="nav-item">
          <a class="nav-link" :class="{'active': $route.path.startsWith('/docs')}" href="/docs">Documentation</a>
        </li>
        <li class="nav-item" v-if="isLogged">
          <a class="nav-link" :class="{'active': $route.path.startsWith('/drive')}" href="/drive">Drives</a>
        </li>
      </ul>
      <ul class="navbar-nav mr-auto align-items-center" v-if="!inVuePress">
        <li>
          <button v-if="!isLogged" class="btn btn-secondary" @click="login">Sign in</button>
          <button v-if="isLogged" class="btn btn-secondary" @click="logout">Logout User</button>
        </li>
      </ul>
    </slot>
  </nav>
</template>
<script>
import {UtilsMixin} from './UtilsMixin.ts';

export default {
  mixins: [ UtilsMixin ],
  props: {
    sidebar: Boolean,
    collapsed: Boolean
  },
  data() {
    return {
      show: false
    };
  },
  computed: {
    inVuePress() {
      return this.$root._.type.name === 'VitePressApp';
    },
    rootFolder() {
      return this.$root.drive;
    }
  }
};
</script>
