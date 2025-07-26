<template>
  <BaseLayout :sidebar="sidebar">
    <template v-slot:navbar="{ collapsed, collapse }">
      <NavBar :sidebar="sidebar" :collapsed="collapsed" @collapse="collapse">
        <NavSearch />
        <NavTabs :folder-path="folderPath" :activeTab="activeTab" :selectedFile="selectedFile" @sync="syncSingle($event.$event, $event.file)" />
      </NavBar>
    </template>

    <template v-slot:sidebar="{ collapse }">
      <GitSideBar
          ref="git_sidebar"
          :selectedPath="selectedPath"
          :gitChanges="gitChanges"
          :checked="checked"
          @toggle="toggle"
          @toggleAll="toggleAll"
          @setCurrentDiff="setCurrentDiff"
          @collapse="collapse"
      />
    </template>

    <form>
      <div class="container d-flex flex-column order-0 w-vh-toolbar w-100">
        <GitToolBar :active-tab="activeTab" :selected-file="selectedFile" />
        <div v-if="file_deleted" class="flex-grow-1">
          <div class="alert-warning p-3 mb-3">
            File deleted
          </div>
        </div>
        <div v-else-if="diffs.length > 0" class="flex-grow-1 overflow-scroll">
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
            <textarea v-grow class="form-control" placeholder="Commit message" v-model="commitMsg"></textarea>
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
    selectedFile: Object,
    selectedFolder: Object
  },
  data() {
    return {
      user_config: {},
      checked: {},
      gitChanges: null,
      commitMsg: '',
      diffs: [],
      selectedPath: '',
      isSomethingChecked: false
    };
  },
  computed: {
    file_deleted() {
      return false;
      // return !this.selectedFile.id && !this.selectedFolder?.path && !['/toc.md'].includes(this.selectedFile.path);
    },
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
    },
    checked: {
      deep: true,
      handler() {
        this.generateCommitMsg();
        this.isSomethingChecked = Object.keys(this.checked).length > 0;
      }
    }
  },
  async created() {
    this.emitter.addEventListener('tree:changed', () => {
      this.fetch();
    });
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

      if (this.$route.hash === '#git_commit') {
        this.$router.push('/drive/' + this.driveId + path + '#git_commit');
      }

      if (file.children && file.children.length > 0) {
        return;
      }

      if (path) {
        this.diffs = await this.GitClientService.getDiff(this.driveId, path);

        this.checked = {
          [path.substring(1)]: true
        };
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

      this.$nextTick(() => {
        const el = this.$el.querySelector('[data-path="' + this.selectedPath + '"]');
        if (el) {
          el.scrollIntoView();
        }
      });

      this.isSomethingChecked = Object.keys(this.checked).length > 0;
    },
    open(url) {
      window.open(url, '_blank');
    },
    async submitCommitBranch(event) {
      if (!this.commitMsg) {
        alert('No commit message');
        return;
      }

      const checkedFileNames = Object.keys(this.checked);
      if (checkedFileNames.length === 0) {
        alert('No files selected');
        return;
      }

      const branch = window.prompt('Enter branch name');
      if (!branch) {
        alert('No branch name');
        return;
      }

      await disableElement(event, async () => {
        const filePaths = [];

        for (const checkedFileName of checkedFileNames) {
          filePaths.push(checkedFileName);
        }

        await this.commitBranch({
          branch,
          message: this.commitMsg,
          filePaths
        });
        this.commitMsg = '';
      });
    },
    async submitCommit(event) {
      if (!this.commitMsg) {
        alert('No commit message');
        return;
      }

      const checkedFileNames = Object.keys(this.checked);
      if (checkedFileNames.length === 0) {
        alert('No files selected');
        return;
      }

      await disableElement(event, async () => {
        const filePaths = [];

        for (const checkedFileName of checkedFileNames) {
          filePaths.push(checkedFileName);
        }

        try {
          await this.commit({
            message: this.commitMsg,
            filePaths
          });
          this.commitMsg = '';
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
    toggleAll() {
      if (Object.keys(this.checked).length === this.gitChanges.length) {
        this.checked = {};
      } else {
        for (const change of this.gitChanges) {
          this.checked[change.path] = true;
        }
      }
      this.isSomethingChecked = Object.keys(this.checked).length > 0;
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
    async generateCommitMsg() {
      if (Object.keys(this.checked).length > 1) {
        this.commitMsg = '';
      }
      if (Object.keys(this.checked).length === 1) {
        const path = Object.keys(this.checked)[0];
        try {
          const response = await this.authenticatedClient.fetchApi(`/api/file/${this.driveId}/${path}`);

          const body = await response.text();
          const lines = body.split('\n');

          const titleLine = lines.find(line => line.startsWith('title: '));
          const title = titleLine ? titleLine.substring('title: '.length).replace(/^'(.+)'$/, '$1') : '';

          const lastAuthor = response.headers.get('wgd-last-author');

          if (lastAuthor && title) {
            this.commitMsg = `${lastAuthor} updated ${title}`;
          }
        } catch (err) {
          console.warn(err);
        }
      }
    }
  }
};
</script>
