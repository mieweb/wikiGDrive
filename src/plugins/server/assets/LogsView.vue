<template>
  <div class="table-responsive">
    <table class="table table-striped table-sm">
      <thead>
      <tr>
        <th scope="col">#</th>
        <th scope="col">Level</th>
        <th scope="col">Message</th>
        <th scope="col">Stack</th>
      </tr>
      </thead>
      <tbody>
      <tr v-for="row in logs" :class="{'alert-danger': row.level === 'error'}">
        <td>{{ row.timestamp }}</td>
        <td>{{ row.level }}</td>
        <td>{{ row.message }}</td>
        <td><pre>{{ row.stack }}{{ row.origError }}</pre></td>
      </tr>
      </tbody>
    </table>
  </div>
</template>
<script lang="ts">
export default {
  name: 'FileView',
  data() {
    return {
      logs: []
    };
  },
  created() {
    this.fetch();
  },
  methods: {
    async fetch() {
      const response = await fetch(`/logs`);
      const json = await response.json();
      console.log(json.dailyRotateFile);
      this.logs = json.dailyRotateFile;
    },
    markDirty() {
      fetch(`/file/${this.$route.params.id}/mark_dirty`, {
        method: 'POST'
      });
    }
  }
}
</script>
