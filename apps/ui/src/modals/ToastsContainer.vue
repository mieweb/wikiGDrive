<template>
  <div class="toast-container position-fixed bottom-0 end-0 p-3">
    <div class="toast show" role="alert" aria-live="assertive" aria-atomic="true" v-for="(toast, idx) in toasts" :key="idx" @click="clickDefaultLink(toast)">
      <div class="toast-header">
        <strong class="me-auto">{{ toast.title }}</strong>
        <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close" @click.stop.prevent="$root.$removeToastAt(idx)"></button>
      </div>
      <div class="toast-body overflow-scroll mh-90" v-if="toast.description || toast.err || Object.keys(links).length > 0">
        {{ toast.description }}
        {{ toast.err }}
        <a :href="getHref(hash)" @click.prevent.stop="setActiveTab(hash.substring(1))" v-for="(title, hash) in links(toast)" :key="hash">
          {{ title }}
        </a>
      </div>
    </div>

  </div>
</template>
<script lang="ts">
import {UtilsMixin} from '../components/UtilsMixin';

export default {
  data() {
    return {};
  },
  mixins: [UtilsMixin],
  computed: {
    fullDrivePath() {
      if (this.isAddon) {
        return '/drive/' + this.driveId;
      }
      return '';
    },
    toasts() {
      return this.$root.toasts;
    }
  },
  methods: {
    getHref(hash) {
      return this.$router.resolve({ path: this.fullDrivePath, hash });
    },
    links(toast) {
      if (toast.links && 'object' === typeof toast.links) {
        return toast.links;
      }

      return {
        '#sync': 'view jobs...'
      };
    },
    clickDefaultLink(toast) {
      const links = Object.keys(this.links(toast));
      if (links.length === 1) {
        this.$router.push({ hash: links[0] });
      }
    }
  }
};
</script>
