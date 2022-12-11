<template>
  <BaseLayout :sidebar="sidebar">
    <template v-slot:navbar="{ collapsed, collapse }">
      <NavBar :sidebar="sidebar" :collapsed="collapsed" @collapse="collapse">
        <NavSearch />
        <NavTabs :folder-path="folderPath" :activeTab="activeTab" :selectedFile="selectedFile" @sync="syncSingle" />
      </NavBar>
    </template>

    <template v-slot:sidebar="{ collapse }">
      <GitSideBar
          :selectedPath="selectedPath"
          :gitChanges="gitChanges"
          :checked="checked"
          @toggle="toggle"
          @setCurrentDiff="setCurrentDiff"
          @collapse="collapse"
      />
    </template>

    <form>
      <div class="container d-flex flex-column w-vh-toolbar">
        <GitToolBar :active-tab="activeTab" />

        <div v-if="diffs.length > 0" class="flex-grow-1 overflow-scroll">
          <h5>Git Diff</h5>
          <div v-for="(diff, idx) of diffs" :key="idx">
            <pre><code ref="code" class="language-diff line-numbers">{{diff.txt}}</code></pre>
          </div>
        </div>
        <div v-else class="flex-grow-1 overflow-scroll">
          <h5>Git Diff</h5>
          <p>
            Select single file on the left to see diff
          </p>
        </div>

        <GitFooter v-if="isSomethingChecked" :checked="checked">
          <div class="input-groups">
            <textarea v-grow class="form-control" placeholder="Commit message" v-model="message"></textarea>
          </div>
          <button type="button" class="btn btn-primary" @click="submitCommit">Commit</button>
          <button type="button" class="btn btn-primary" @click="submitCommitBranch">Commit into Branch</button>
        </GitFooter>
        <GitFooter v-else :checked="checked"></GitFooter>
      </div>
    </form>
  </BaseLayout>

</template>
<script>
import {disableElement, UtilsMixin} from './UtilsMixin.ts';
import {GitMixin} from './GitMixin.ts';
import BaseLayout from '../layout/BaseLayout.vue';
import NavBar from './NavBar.vue';
import NavTabs from './NavTabs.vue';
import GitSideBar from './GitSideBar.vue';
import GitToolBar from './GitToolBar.vue';
import NavSearch from './NavSearch.vue';
import GitFooter from './GitFooter.vue';
const Prism = window['Prism'];
Prism.manual = true;

export default {
  mixins: [UtilsMixin, GitMixin],
  components: {
    GitFooter,
    GitToolBar,
    GitSideBar,
    BaseLayout,
    NavBar,
    NavSearch,
    NavTabs
  },
  props: {
    sidebar: Boolean,
    activeTab: {
      type: String
    },
    folderPath: {
      type: String
    },
    contentDir: {
      type: String
    },
    selectedFile: Object
  },
  data() {
    return {
      user_config: {},
      checked: {},
      gitChanges: null,
      message: '',
      diffs: [],
      selectedPath: '',
      isSomethingChecked: false
    };
  },
  computed: {
    git_remote_url() {
      return this.user_config.remote_url || '';
    },
    isCheckedAll() {
      return Object.keys(this.checked).length === this.gitChanges?.length;
    },
    historyPath() {
      if (this.contentDir) {
        const contentDir = this.contentDir.replace(/\/$/, '');
        return contentDir + (this.selectedFile?.path || '');
      } else {
        return this.selectedFile?.path || '/';
      }
    }
  },
  watch: {
    diffs() {
      this.$nextTick(() => {
        const codeElems = this.$el.querySelectorAll('code');
        for (const elem of codeElems.values()) {
          Prism.highlightElement(elem);
        }
      });
    }
  },
  async created() {
    await this.fetch();
  },
  methods: {
    async setCurrentDiff(file) {
      this.diffs = [];

      if (!file) {
        return;
      }

      const path = file.path.startsWith('/') ? file.path : '/' + file.path;
      this.selectedPath = path.substring(1);

      this.$router.push('/drive/' + this.driveId + path + '#git_commit');

      if (file.children && file.children.length > 0) {
        return;
      }

      if (path) {
        this.diffs = await this.GitClientService.getDiff(this.driveId, path);
      }
    },
    async fetch() {
      this.gitChanges = null;
      const response = await this.authenticatedClient.fetchApi(`/api/git/${this.driveId}/commit`);
      const json = await response.json();
      this.gitChanges = json.changes;
      this.checked = {};

      const fileName = this.historyPath.substring(1);
      if (this.gitChanges.find(item => item.path === fileName)) {
        this.toggle(fileName);
      }

      if (this.selectedFile?.path) {
        this.setCurrentDiff({ path: this.historyPath });
      } else {
        await this.setCurrentDiff(null);
        this.selectedPath = this.historyPath.substr(1);
      }

      const responseConfig = await this.authenticatedClient.fetchApi(`/api/config/${this.driveId}`);
      this.user_config = await responseConfig.json();
    },
    open(url) {
      window.open(url, '_blank');
    },
    async submitCommitBranch(event) {
      if (!this.message) {
        alert('No commit message');
        return;
      }

      const checkedFileNames = Object.keys(this.checked);
      if (checkedFileNames.length === 0) {
        alert('No files selected');
        return;
      }

      const branch = window.prompt('Enter branch name');

      await disableElement(event, async () => {
        const filePath = [];

        for (const checkedFileName of checkedFileNames) {
          const change = this.gitChanges.find(change => change.path === checkedFileName);
          if (!change?.state?.isDeleted) {
            filePath.push(checkedFileName);
          }
        }

        await this.commitBranch({
          branch,
          message: this.message,
          filePath: filePath,
          removeFilePath: []
        });
        this.message = '';
      });
    },
    async submitCommit(event) {
      if (!this.message) {
        alert('No commit message');
        return;
      }

      const checkedFileNames = Object.keys(this.checked);
      if (checkedFileNames.length === 0) {
        alert('No files selected');
        return;
      }

      await disableElement(event, async () => {
        const filePath = [];
        const removeFilePath = [];

        for (const checkedFileName of checkedFileNames) {
          const change = this.gitChanges.find(change => change.path === checkedFileName);
          if (change?.state?.isDeleted) {
            removeFilePath.push(checkedFileName);
          } else {
            filePath.push(checkedFileName);
          }
        }

        try {
          await this.commit({
            message: this.message,
            filePath: filePath,
            removeFilePath: removeFilePath
          });
          this.message = '';
        } catch (err) {
          if (err.message === 'cannot push non-fastforwardable reference') {
            if (window.confirm('Git error: ' + err.message + '. Do you want to reset git repository with remote branch?')) {
              await this.authenticatedClient.fetchApi(`/api/git/${this.driveId}/reset_remote`, {
                method: 'post'
              });
              window.location.hash = '#git_log';
            }
            return;
          }
          if (err === 'no merge base found' || err === 'this patch has already been applied' || err.message === 'rebase conflict') {
            if (window.confirm('Rebase conflict. Do you want to reset git repository with remote branch?')) {
              await this.authenticatedClient.fetchApi(`/api/git/${this.driveId}/reset_remote`, {
                method: 'post'
              });
              window.location.hash = '#git_log';
            }
            return;
          }
          window.location.hash = '#drive_logs';
        }
      });
    },
    toggle(path) {
      if (this.checked[path]) {
        delete this.checked[path];
      } else {
        this.checked[path] = true;
      }

      if (path.endsWith('.md')) {
        const assetPath = path.replace(/.md$/, '.assets/');
        for (const assetChange of this.gitChanges) {
          if (!assetChange.path.startsWith(assetPath)) {
            continue;
          }
          if (this.checked[path]) {
            this.checked[assetChange.path] = true;
          } else {
            delete this.checked[assetChange.path];
          }
        }
      }
      this.isSomethingChecked = Object.keys(this.checked).length > 0;
    },
    toggleCheckAll() {
      if (this.isCheckedAll) {
        this.checked = {};
        this.isSomethingChecked = false;
      } else {
        for (const item of this.gitChanges) {
          this.checked[item.path] = true;
        }
        this.isSomethingChecked = true;
      }
    }
  }
};
</script>
