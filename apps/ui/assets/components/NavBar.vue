<template>
  <nav class="navbar navbar-expand-lg navbar-dark bg-primary">
    <router-link v-if="!isSinglePreview && rootFolder.name" class="navbar-brand" :to="{ name: 'drive', params: {driveId} }">{{ rootFolder.name }}</router-link>
    <span class="navbar-brand" v-else-if="!isSinglePreview">WikiGDrive</span>
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
