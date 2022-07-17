<template>
  <div class="container">
    <table class="table table-bordered" v-if="logs && logs.length > 0">
      <thead>
      <tr>
        <th>Level</th>
        <th>Time</th>
        <th>File</th>
        <th>Message</th>
      </tr>
      </thead>
      <tbody>
      <tr v-for="(item, idx) of logs" :key="idx">
        <td>{{item.level}}</td>
        <td>{{item.timestamp}}</td>
        <td v-html="getLink(item.filename)"></td>
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
    },
    getLink(fileName) {
      if (!fileName) {
        return '';
      }
      const [path, line] = fileName.split(':');
      const branch = process.env.DOMAIN === 'https://dev.wikigdrive.com' ? 'develop' : 'master';
      const url = `https://github.com/mieweb/wikiGDrive/blob/${branch}/${path}#L${line}`;
      let baseName = path.split('/').pop();
      return `<a target="github" href="${url}">${baseName}</a>`;
    }
  }
};
</script>
