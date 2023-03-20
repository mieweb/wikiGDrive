<template>
  <BaseLayout :sidebar="sidebar">
    <template v-slot:navbar="{ collapsed, collapse }">
      <NavBar :sidebar="sidebar" :collapsed="collapsed" @collapse="collapse">
        <NavSearch />
        <NavTabs :folder-path="folderPath" :activeTab="activeTab" :selectedFile="selectedFile" @sync="syncSingle" />
      </NavBar>
    </template>

    <template v-slot:sidebar>
      <ul class="nav files-list border-bottom dark">
        <li class="nav-item fs-4">
          <div class="files-list__item">
            <i class="fa-solid fa-terminal"></i>&nbsp; Commands
          </div>
        </li>
      </ul>

      <div class="btn-group-vertical w-100 p-1">
        <button type="button" class="btn btn-secondary mb-1" @click="cmd('status')">git status</button>
        <button type="button" class="btn btn-secondary mb-1" @click="cmd('remote -v')">git remote -v</button>
      </div>
    </template>

    <form>
      <div class="container d-flex flex-column order-0 w-vh-toolbar w-100">
        <GitToolBar :active-tab="activeTab" :selected-file="selectedFile" />
        <pre><code ref="code" class="language-diff line-numbers">{{ stderr }}{{ stdout }}</code></pre>
      </div>
    </form>
  </BaseLayout>
</template>
<script>
import {UtilsMixin} from './UtilsMixin.ts';
import {GitMixin} from './GitMixin.ts';
import BaseLayout from '../layout/BaseLayout.vue';
import NavBar from './NavBar.vue';
import NavSearch from './NavSearch.vue';
import NavTabs from './NavTabs.vue';
import GitToolBar from './GitToolBar.vue';
const Prism = window['Prism'];
Prism.manual = true;

export default {
  mixins: [UtilsMixin, GitMixin],
  components: {
    BaseLayout,
    GitToolBar,
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
  computed: {
    git_remote_url() {
      return this.user_config.remote_url || '';
    }
  },
  data() {
    return {
      stdout: '',
      stderr: ''
    };
  },
  created() {
    this.cmd('status');
  },
  watch: {
    stdout() {
      this.$nextTick(() => {
        const codeElems = this.$el.querySelectorAll('code');
        for (const elem of codeElems.values()) {
          Prism.highlightElement(elem);
        }
      });
    },
    stderr() {
      this.$nextTick(() => {
        const codeElems = this.$el.querySelectorAll('code');
        for (const elem of codeElems.values()) {
          Prism.highlightElement(elem);
        }
      });
    }

  },
  methods: {
    async cmd(cmd) {
      this.gitChanges = null;
      const response = await this.authenticatedClient.fetchApi(`/api/git/${this.driveId}/cmd`, {
        method: 'post',
        headers: {
          'Content-type': 'application/json'
        },
        body: JSON.stringify({ cmd })
      });
      const json = await response.json();
      this.stdout = json.stdout;
      this.stderr = json.stderr;
    }
  }
};
</script>
