<template>
  <div class="container">
    <GitToolBar :active-tab="activeTab" />

    <h5>Git log: {{ historyPath }}</h5>

    <table class="table table-bordered" v-if="history && history.length > 0">
      <thead>
      <tr>
        <th>Date</th>
        <th>Author</th>
        <th>Message</th>
      </tr>
      </thead>
      <tbody>
      <tr v-for="(item, idx) of history" :key="idx">
        <td>{{item.date}}<br /><small>{{ item.id }}</small></td>
        <td>{{item.author_name}}</td>
        <td><pre>{{item.message}}</pre></td>
      </tr>
      </tbody>
    </table>
    <div v-else>
      <div class="alert alert-info">
        Git log empty
      </div>
    </div>
  </div>
</template>
<script>
import {UtilsMixin} from './UtilsMixin.mjs';
import GitToolBar from './GitToolBar.vue';

export default {
  name: 'GitLog',
  mixins: [UtilsMixin],
  components: {GitToolBar},
  props: {
    activeTab: {
      type: String
    },
    folderPath: {
      type: String
    },
    selectedFile: Object
  },
  computed: {
    historyPath() {
      if (this.folderPath) {
        const folderPath = this.folderPath.replace(/\/$/, '');
        return folderPath + '/' + (this.selectedFile?.fileName || '');
      } else {
        return '/' + (this.selectedFile?.fileName || '');
      }
    }
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
      this.history = await this.GitClientService.getHistory(this.driveId, this.historyPath);
    }
  }
};
</script>
