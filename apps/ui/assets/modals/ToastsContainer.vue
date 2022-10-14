<template>
  <div class="toast-container position-fixed bottom-0 end-0 p-3">
    <div class="toast show" role="alert" aria-live="assertive" aria-atomic="true" v-for="(toast, idx) in toasts" :key="idx" @click="clickDefaultLink(toast)">
      <div class="toast-header">
        <strong class="me-auto">{{ toast.title }}</strong>
        <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close" @click.stop.prevent="$root.$removeToastAt(idx)"></button>
      </div>
      <div class="toast-body">
        {{ toast.description }}
        {{ toast.err }}
        <router-link :to="{ hash }" v-for="(title, hash) in links(toast)" :key="hash">
          {{ title }}
        </router-link>
      </div>
    </div>

  </div>
</template>
<script lang="ts">
export default {
  data() {
    return {};
  },
  computed: {
    toasts() {
      return this.$root.toasts;
    }
  },
  methods: {
    links(toast) {
      if (toast.links && Object.keys(toast.links).length > 0) {
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
