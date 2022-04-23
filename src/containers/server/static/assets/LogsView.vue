<template>
  <BaseLayout>
    <template v-slot:navbar>
      <div></div>
    </template>

    <template v-slot:default>
      <div class="table-responsive">
        <table class="mui-table mui-table--bordered">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Level</th>
              <th scope="col">Message</th>
              <th scope="col">Stack</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, idx) in logs" :key="idx" :class="{'alert-danger': row.level === 'error'}">
              <td>{{ row.timestamp }}</td>
              <td>{{ row.level }}</td>
              <td>{{ row.message }}</td>
              <td><pre>{{ row.stack }}{{ row.origError }}</pre></td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </BaseLayout>
</template>
<script lang="ts">
import BaseLayout from './BaseLayout.vue';
export default {
  name: 'FileView',
  components: {BaseLayout},
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
      const response = await fetch('/logs');
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
};
</script>
