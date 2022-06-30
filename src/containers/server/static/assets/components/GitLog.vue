<template>
  <div class="mui-container">
    <table class="mui-table mui-table--bordered" v-if="history && history.length > 0">
      <thead>
      <tr>
        <th>Date</th>
        <th>Author</th>
        <th>Message</th>
      </tr>
      </thead>
      <tbody>
      <tr v-for="(item, idx) of history" :key="idx">
        <td>{{item.date}}</td>
        <td>{{item.author_name}}</td>
        <td>{{item.message}}</td>
      </tr>
      </tbody>
    </table>
    <div v-else>
      Not committed
    </div>
  </div>
</template>
<script>
import {UtilsMixin} from './UtilsMixin.mjs';

export default {
  name: 'GitLog',
  mixins: [UtilsMixin],
  props: {
    folderPath: {
      type: String
    },
    selectedFile: Object
  },
  data() {
    return {
      history: []
    };
  },
  async created() {
    await this.fetch();
  },
  watch: {
    async selectedFile() {
      await this.fetch();
    }
  },
  methods: {
    async fetch() {
      this.history = await this.GitClientService.getHistory(this.driveId, this.folderPath + this.selectedFile.fileName);
    }
  }
};
</script>
