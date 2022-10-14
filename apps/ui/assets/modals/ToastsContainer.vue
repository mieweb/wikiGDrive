<template>
  <div class="toast-container position-fixed bottom-0 end-0 p-3">
    <div class="toast show" role="alert" aria-live="assertive" aria-atomic="true" v-for="(toast, idx) in toasts" :key="idx" @click="$router.push({ hash: '#sync' })">
      <div class="toast-header">
        <strong class="me-auto">{{ toast.title }}</strong>
        <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close" @click.stop.prevent="$root.$removeToastAt(idx)"></button>
      </div>
      <div class="toast-body">
        {{ toast.description }}
        <router-link :to="{ hash: '#sync' }">
          view jobs...
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
  }
};
</script>
