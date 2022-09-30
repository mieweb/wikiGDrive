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
          @toggleCheckAll="toggleCheckAll"
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

        <div class="card" v-if="isSomethingChecked">
          <div class="card-body">
            <div class="input-groups">
              <textarea v-grow class="form-control" placeholder="Commit message" v-model="message"></textarea>
            </div>
            <button :disabled="Object.keys(working).length > 0" type="button" class="btn btn-primary" @click="submitCommit"><i v-if="working.commit" class="fa-solid fa-rotate fa-spin"></i> Commit</button>
            <button :disabled="Object.keys(working).length > 0" v-if="git_remote_url" type="button" class="btn btn-danger" @click="push"><i v-if="working.push" class="fa-solid fa-rotate fa-spin"></i> Commit and Push</button>
            <button :disabled="Object.keys(working).length > 0" v-if="git_remote_url" type="button" class="btn btn-secondary" @click="pull"><i v-if="working.pull" class="fa-solid fa-rotate fa-spin"></i> Pull</button>
          </div>
        </div>
        <div v-else>
          <div class="card-body">
            <button :disabled="Object.keys(working).length > 0" v-if="git_remote_url" type="button" class="btn btn-danger" @click="push"><i v-if="working.push" class="fa-solid fa-rotate fa-spin"></i> Push</button>
            <button :disabled="Object.keys(working).length > 0" v-if="git_remote_url" type="button" class="btn btn-secondary" @click="pull"><i v-if="working.pull" class="fa-solid fa-rotate fa-spin"></i> Pull</button>
          </div>
        </div>
      </div>
    </form>
  </BaseLayout>

</template>
<script>
import {UtilsMixin} from './UtilsMixin.mjs';
import {GitMixin} from './GitMixin.mjs';
import BaseLayout from '../layout/BaseLayout.vue';
import NavBar from './NavBar.vue';
import NavTabs from './NavTabs.vue';
import GitSideBar from './GitSideBar.vue';
import GitToolBar from './GitToolBar.vue';
import NavSearch from './NavSearch.vue';
const Prism = window['Prism'];
Prism.manual = true;

export default {
  mixins: [UtilsMixin, GitMixin],
  components: {
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
    selectedFile: Object
  },
  data() {
    return {
      user_config: {},
      checked: {},
      gitChanges: null,
      message: '',
      working: {},
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
      if (this.folderPath) {
        const folderPath = this.folderPath.replace(/\/$/, '');
        return folderPath + '/' + (this.selectedFile?.fileName || '');
      } else {
        return '/' + (this.selectedFile?.fileName || '');
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
    async setCurrentDiff(path) {
      this.diffs = [];
      if (path) {
        this.diffs = await this.GitClientService.getDiff(this.driveId, path);
      }
      this.selectedPath = path.substring(1);
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

      this.setCurrentDiff(this.selectedFile?.fileName ? this.historyPath : '');

      const responseConfig = await this.authenticatedClient.fetchApi(`/api/config/${this.driveId}`);
      this.user_config = await responseConfig.json();
    },
    open(url) {
      window.open(url, '_blank');
    },
    async submitCommit() {
      try {
        this.working.commit = true;

        if (!this.message) {
          alert('No commit message');
          return;
        }

        const checkedFileNames = Object.keys(this.checked);
        if (checkedFileNames.length === 0) {
          alert('No files selected');
          return;
        }

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

        await this.commit({
          message: this.message,
          filePath: filePath,
          removeFilePath: removeFilePath
        });
        this.message = '';

        window.location.hash = '#git_log';
      } catch (err) {
        if (err.message === 'rebase conflict') {
          if (window.confirm('Rebase conflict. Do you want to reset git repository with remote branch?')) {
            await this.authenticatedClient.fetchApi(`/api/git/${this.driveId}/reset_remote`, {
              method: 'post'
            });
            window.location.hash = '#git_log';
          }
          return;
        }
        window.location.hash = '#drive_logs';
      } finally {
        delete this.working.commit;
      }
    },
    async pull() {
      try {
        this.working.pull = true;
        const response = await this.authenticatedClient.fetchApi(`/api/git/${this.driveId}/pull`, {
          method: 'post',
          headers: {
            'Content-type': 'application/json'
          },
          body: JSON.stringify({})
        });
        const json = await response.json();
        await this.fetch();
        if (json.error) {
          alert(json.error);
          window.location.hash = '#drive_logs';
        } else {
          alert('Pull completed');
          window.location.hash = '#git_log';
        }
      } catch (err) {
        window.location.hash = '#drive_logs';
      } finally {
        delete this.working.pull;
      }
    },
    async push() {
      try {
        const checkedFileNames = Object.keys(this.checked);
        if (checkedFileNames.length > 0) {
          await this.submitCommit();
        }

        this.working.push = true;

        const response = await this.authenticatedClient.fetchApi(`/api/git/${this.driveId}/push`, {
          method: 'post',
          headers: {
            'Content-type': 'application/json'
          },
          body: JSON.stringify({})
        });

        const json = await response.json();
        await this.fetch();
        if (json.error) {
          alert(json.error);
          window.location.hash = '#drive_logs';
        } else {
          alert('Push completed');
          window.location.hash = '#git_log';
        }
      } catch (err) {
        if (err.message === 'rebase conflict') {
          if (window.confirm('Rebase conflict. Do you want to reset git repository with remote branch?')) {
            await this.authenticatedClient.fetchApi(`/api/git/${this.driveId}/reset_remote`, {
              method: 'post'
            });
            window.location.hash = '#git_log';
          }
          return;
        }
        window.location.hash = '#drive_logs';
      } finally {
        delete this.working.push;
      }
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
