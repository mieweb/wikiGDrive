<template>
  <div>
    <div class="d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center pt-3 pb-2 mb-3 border-bottom">
      <h1 class="h2">Dashboard</h1>
      <div class="btn-toolbar mb-2 mb-md-0">
        <div class="btn-group me-2">
          <button type="button" class="btn btn-sm btn-outline-secondary" @click="markDirty">Mark dirty</button>
        </div>
      </div>
    </div>
  </div>
  <pre>{{ file }}</pre>
</template>
<script lang="ts">
export default {
  name: 'FileView',
  data() {
    return {
      file: null
    };
  },
  created() {
    this.fetch();
  },
  methods: {
    async fetch() {
      const response = await fetch(`/file/${this.$route.params.id}`);
      const json = await response.json();
      console.log(this.$route.params.id, json);
      this.file = json;
    },
    markDirty() {
      fetch(`/file/${this.$route.params.id}/mark_dirty`, {
        method: 'POST'
      });
    }
  }
}
</script>
