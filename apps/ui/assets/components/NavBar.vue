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
    <slot></slot>
  </nav>
</template>
<script>
import {UtilsMixin} from './UtilsMixin.mjs';

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
    rootFolder() {
      return this.$root.drive;
    }
  }
};
</script>
