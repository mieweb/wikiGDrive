<template>
  <div class="container">
    <div class="row py-1">
      <div class="col-12 text-end">
        <ToolButton
            v-if="github_url"
            :active="activeTab === 'git_log'"
            @click="openWindow(github_url)"
            title="GitHub"
            icon="fa-brands fa-github"
        />

        <ToolButton
            v-if="gitInitialized"
            :active="activeTab === 'git_log'"
            @click="setActiveTab('git_log')"
            title="History"
            icon="fa-solid fa-timeline"
        />

        <ToolButton
            v-if="gitInitialized"
            :active="activeTab === 'git_commit'"
            @click="setActiveTab('git_commit')"
            title="Commit"
            icon="fa-solid fa-code-commit"
        />
      </div>
    </div>

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
        <td>{{item.date}}</td>
        <td>{{item.author_name}}</td>
        <td>{{item.message}}</td>
      </tr>
      </tbody>
    </table>
    <div v-else>
      <div class="alert alert-info">
        Git log empty
      </div>
    </div>

    <div v-if="diffs.length > 0">
      <h5>Git Diff</h5>
      <div v-for="(diff, idx) of diffs" :key="idx">
        <pre><code ref="code" class="language-diff line-numbers">{{diff.txt}}</code></pre>
      </div>
    </div>
  </div>
</template>
<script>
import {UtilsMixin} from './UtilsMixin.mjs';
import ToolButton from './ToolButton.vue';
const Prism = window['Prism'];
Prism.manual = true;

export default {
  name: 'GitLog',
  mixins: [UtilsMixin],
  components: {ToolButton},
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
      if (this.folderPath && this.folderPath !== '/') {
        return this.folderPath + '/' + (this.selectedFile?.fileName || '');
      } else {
        return '/' + (this.selectedFile?.fileName || '');
      }
    }
  },
  data() {
    return {
      history: [],
      diffs: []
    };
  },
  async created() {
    await this.fetch();
  },
  watch: {
    async selectedFile() {
      await this.fetch();
    },
    diffs() {
      this.$nextTick(() => {
        const codeElems = this.$el.querySelectorAll('code');
        for (const elem of codeElems.values()) {
          Prism.highlightElement(elem);
        }
      });
    }
  },
  methods: {
    async fetch() {
      this.history = await this.GitClientService.getHistory(this.driveId, this.historyPath);
      this.diffs = [];
      if (this.selectedFile?.fileName) {
        this.diffs = await this.GitClientService.getDiff(this.driveId, this.historyPath);
      }
    }
  }
};
</script>
