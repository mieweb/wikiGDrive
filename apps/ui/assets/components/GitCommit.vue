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

    <form>
      <div v-if="changes && changes.length > 0">
        <h2>Changes</h2>
        <table class="table table-bordered">
          <thead>
          <tr>
            <th><input type="checkbox" :checked="isCheckedAll" @click="toggleCheckAll" /></th>
            <th>Path</th>
            <th>Stater</th>
          </tr>
          </thead>
          <tbody>
          <tr v-for="(item, idx) of changes" :key="idx" @click="toggle(item.path)">
            <td><input name="filePath" type="checkbox" :value="item.path" :checked="checked[item.path]" /></td>
            <td>{{item.path}}</td>
            <td>
              <span v-if="item.state.isNew">New</span>
              <span v-else-if="item.state.isModified">Modified</span>
              <span v-else-if="item.state.isRenamed">Renamed</span>
              <span v-else-if="item.state.isDeleted">Deleted</span>
              <span v-else>{{item.state}}</span>
            </td>
          </tr>
          </tbody>
        </table>
      </div>
      <div class="card">
        <div class="card-body">
          <div class="input-groups">
            <textarea class="form-control" placeholder="Commit message" v-model="message"></textarea>
          </div>
          <button type="button" class="btn btn-primary" @click="submitCommit">Commit</button>
          <button v-if="git_remote_url" type="button" class="btn btn-danger" @click="push">Commit and Push</button>
          <button v-if="git_remote_url" type="button" class="btn btn-secondary" @click="pull">Pull</button>
        </div>
      </div>
    </form>
  </div>
</template>
<script>
import {UtilsMixin} from './UtilsMixin.mjs';
import {GitMixin} from './GitMixin.mjs';
import ToolButton from './ToolButton.vue';

export default {
  mixins: [UtilsMixin, GitMixin],
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
  data() {
    return {
      checked: {},
      changes: [],
      message: ''
    };
  },
  computed: {
    git_remote_url() {
      return this.git?.remote_url || '';
    },
    isCheckedAll() {
      return Object.keys(this.checked).length === this.changes.length;
    }
  },
  async created() {
    await this.fetch();
  },
  methods: {
    async fetch() {
      const response = await this.authenticatedClient.fetchApi(`/api/git/${this.driveId}/commit`);
      const json = await response.json();
      this.changes = json.changes;
      this.checked = {};

      const fileName = (this.folderPath + this.selectedFile.fileName).substring(1);
      if (this.changes.find(item => item.path === fileName)) {
        this.checked[fileName] = true;
      }
    },
    open(url) {
      window.open(url, '_blank');
    },
    async submitCommit() {
      if (!this.message) {
        alert('No commit message');
        return;
      }

      const filePath = Object.keys(this.checked);
      if (filePath.length === 0) {
        alert('No files selected');
        return;
      }

      await this.commit({
        message: this.message,
        filePath: filePath
      });
      this.message = '';

      window.location.hash = '#git_log';
    },
    toggle(path) {
      if (this.checked[path]) {
        delete this.checked[path];
      } else {
        this.checked[path] = true;
      }
    },
    toggleCheckAll() {
      if (this.isCheckedAll) {
        this.checked = {};
      } else {
        for (const item of this.changes) {
          this.checked[item.path] = true;
        }
      }
    }
  }
};
</script>
