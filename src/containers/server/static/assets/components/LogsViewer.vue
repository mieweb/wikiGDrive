<template>
  <div class="mui-container">
    <table class="mui-table mui-table--bordered" v-if="logs && logs.length > 0">
      <thead>
      <tr>
        <th>Level</th>
        <th>Time</th>
        <th>Message</th>
      </tr>
      </thead>
      <tbody>
      <tr v-for="(item, idx) of logs" :key="idx">
        <td>{{item.level}}</td>
        <td>{{item.timestamp}}</td>
        <td>{{item.message}}</td>
      </tr>
      </tbody>
    </table>
  </div>
</template>

<script>
import {UtilsMixin} from './UtilsMixin.mjs';

export default {
  mixins: [UtilsMixin],
  data() {
    return {
      logs: []
    };
  },
  async created() {
    await this.fetch();
  },
  watch: {
    async $route() {
      await this.fetch();
    }
  },
  methods: {
    async fetch() {
      const response = await fetch(`/api/logs/${this.driveId}`);
      this.logs = await response.json();
    }
  }
};
</script>
