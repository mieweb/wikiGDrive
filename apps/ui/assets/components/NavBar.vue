<template>
  <nav class="navbar navbar-expand-lg navbar-dark bg-primary">
    <span class="navbar-brand">

      <span v-if="sidebar">
        <a @click.prevent="$emit('collapse')" href="#">
          <i class="fa-solid fa-bars"></i>
        </a>
      </span>

      <span v-if="!isGDocsPreview" class="drive-link">
        <router-link v-if="driveId" class="text-white" :to="{ name: 'drive', params: {driveId} }">{{ rootFolder.name || 'WikiGDrive' }}</router-link>
      </span>
    </span>

<!--    <button class="navbar-toggler" type="button" data-toggle="collapse" @click="show = !show">
      <span class="navbar-toggler-icon"></span>
    </button>-->
    <slot></slot>
<!--    <div class="collapse navbar-collapse" :class="{ show: show }">
    </div>-->
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
