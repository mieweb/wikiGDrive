<template>
  <div class="container d-flex flex-column w-vh-toolbar">
    <GitToolBar :active-tab="activeTab" />

    <div class="flex-grow-1 overflow-scroll">
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
          <td>
            {{item.date}}
            <span v-if="item.head" class="badge badge-info">HEAD</span>
            <span v-if="item.remote" class="badge badge-info">REMOTE</span>
            <br/>
            <small>{{ item.id }}</small>
          </td>
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

    <GitFooter></GitFooter>
  </div>
</template>
<script>
import {UtilsMixin} from './UtilsMixin.mjs';
import GitToolBar from './GitToolBar.vue';
import GitFooter from './GitFooter.vue';

export default {
  name: 'GitLog',
  mixins: [UtilsMixin],
  components: {GitToolBar, GitFooter},
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
      git_remote_url() {
        return this.user_config.remote_url || '';
      },
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
      history: [],
      working: {}
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
