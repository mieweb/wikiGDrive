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
            <td><input name="filePath" type="checkbox" :value="item.path" :checked="filePath.indexOf(item.path) > -1" /></td>
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

export default {
  mixins: [UtilsMixin, GitMixin],
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
      changes: [],
      filePath: [],
      message: ''
    };
  },
  computed: {
    git_remote_url() {
      return this.git?.remote_url || '';
    },
    isCheckedAll() {
      return this.filePath.length === this.changes.length;
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
      this.filePath = [];

      const fileName = (this.folderPath + this.selectedFile.fileName).substring(1);
      if (this.changes.find(item => item.path === fileName)) {
        this.filePath.push(fileName);
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
      await this.commit({
        message: this.message,
        filePath: this.filePath
      });
      this.message = '';
    },
    toggle(path) {
      const idx = this.filePath.indexOf(path);
      if (idx === -1) {
        this.filePath.push(path);
      } else {
        this.filePath.splice(idx, 1);
      }
    },
    toggleCheckAll() {
      if (this.isCheckedAll) {
        this.filePath.splice(0, this.filePath.length);
      } else {
        for (const item of this.changes) {
          if (this.filePath.indexOf(item.path) === -1) {
            this.filePath.push(item.path);
          }
        }
      }
    }
  }
};
</script>
