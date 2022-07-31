<template>
  <div class="x-container">

    <ul class="list-group">
      <li class="list-group-item" v-if="github_url"><a @click.prevent.stop="openWindow(github_url)">GitHub</a></li>
      <li class="list-group-item" v-if="gitInitialized" :class="{ 'active': activeTab === 'git_log' }">
        <a @click.prevent.stop="setActiveTab('git_log')">History</a>
      </li>
      <li class="list-group-item" v-if="gitInitialized" :class="{ 'active': activeTab === 'git_commit' }">
        <a @click.prevent.stop="setActiveTab('git_commit')">Commit</a>
      </li>
    </ul>

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
    activeTab: {
      type: String
    },
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
      this.history = await this.GitClientService.getHistory(this.driveId, (this.folderPath || '') + (this.selectedFile?.fileName || ''));
    }
  }
};
</script>
