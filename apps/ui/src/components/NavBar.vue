<template>
  <nav class="navbar navbar-expand-lg navbar-dark bg-nav" data-allow-mismatch>
    <span class="navbar-brand">

      <span v-if="sidebar">
        <a @click.prevent="$emit('collapse')" href="#">
          <i class="fa-solid fa-bars"></i>&nbsp;
        </a>
      </span>
      <span v-if="!isGDocsPreview" class="drive-link">
        <router-link activeClass="active" :to="{ name: 'home' }">WikiGDrive</router-link>
        <span v-if="rootFolder && rootFolder.name && !isOnDrivesListPage" class="d-none d-lg-inline"> - {{ rootFolder.name }}</span>
      </span>
    </span>
    <slot>
      <ul class="navbar-nav mr-auto align-items-center justify-content-start">
        <li class="nav-item">
          <router-link activeClass="active" class="nav-link" :to="{ name: 'docs' }">Documentation</router-link>
        </li>
        <li class="nav-item" v-if="isLogged">
          <router-link activeClass="active" class="nav-link" :to="{ name: 'drives' }">Drives</router-link>
        </li>
      </ul>
      <ul class="navbar-nav mr-auto align-items-center" v-if="!inVitePress">
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
    inVitePress() {
      return this.$root._.type.name === 'VitePressApp';
    },
    rootFolder() {
      return this.$root.drive;
    },
    isOnDrivesListPage() {
      return this.$route.name === 'drives';
    }
  }
};
</script>
