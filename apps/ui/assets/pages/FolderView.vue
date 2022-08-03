<template>
  <BaseLayout :share-email="shareEmail" :sidebar="sidebar">
    <template v-slot:navbar="{ collapsed, collapse }">
      <NavBar :sidebar="sidebar" :collapsed="collapsed" @collapse="collapse">
        <NavTabs :folder-path="folderPath" :activeTab="activeTab" :selectedFile="selectedFile" @sync="syncSingle" />
      </NavBar>
    </template>

    <template v-slot:sidebar="{ collapse }">
      <FilesTable :folder-path="folderPath" :files="files" :not-registered="notRegistered" v-if="sidebar" @collapse="collapse" />
    </template>
    <template v-slot:default>
      <NotRegistered v-if="notRegistered" />

      <ChangesViewer v-if="activeTab === 'sync'" :selected-file="selectedFile" :activeTab="activeTab" @sync="syncSingle" />
      <GitLog v-if="activeTab === 'git_log'" :folderPath="folderPath" :selectedFile="selectedFile" :active-tab="activeTab" />
      <GitCommit v-if="activeTab === 'git_commit'" :folderPath="folderPath" :selectedFile="selectedFile" :active-tab="activeTab" />

      <DriveTools v-if="activeTab === 'drive_tools'" :folderPath="folderPath" :selectedFile="selectedFile" :active-tab="activeTab" />
      <LogsViewer v-if="activeTab === 'drive_logs'" />
      <UserConfig v-if="activeTab === 'drive_config'" />

      <div v-if="(activeTab === 'html' || activeTab === 'markdown' || activeTab === 'drive_backlinks') && selectedFile.mimeType === 'text/x-markdown'">
        <FilePreview :folder-path="folderPath" :activeTab="activeTab" :selectedFile="selectedFile" />
      </div>
      <div v-if="(activeTab === 'html' || activeTab === 'markdown' || activeTab === 'drive_backlinks') && selectedFile.mimeType === 'image/svg+xml'">
        <ImagePreview :folder-path="folderPath" :activeTab="activeTab" :selectedFile="selectedFile" />
      </div>
    </template>
  </BaseLayout>
</template>
<script lang="ts">
import BaseLayout from '../layout/BaseLayout.vue';
import {DEFAULT_TAB, UiMixin} from '../components/UiMixin.mjs';
import FilesTable from '../components/FilesTable.vue';
import {UtilsMixin} from '../components/UtilsMixin.mjs';
import NotRegistered from './NotRegistered.vue';
import FilePreview from '../components/FilePreview.vue';
import ImagePreview from '../components/ImagePreview.vue';
import NavTabs from '../components/NavTabs.vue';
import LogsViewer from '../components/LogsViewer.vue';
import ChangesViewer from '../components/ChangesViewer.vue';
import UserConfig from '../components/UserConfig.vue';
import GitLog from '../components/GitLog.vue';
import GitCommit from '../components/GitCommit.vue';
import DriveTools from '../components/DriveTools.vue';
import NavBar from '../components/NavBar.vue';

export default {
  name: 'FolderView',
  components: {
    NavBar,
    DriveTools,
    NavTabs,
    NotRegistered,
    FilesTable,
    BaseLayout,
    FilePreview,
    ImagePreview,
    LogsViewer,
    ChangesViewer,
    UserConfig,
    GitLog,
    GitCommit
  },
  mixins: [ UtilsMixin, UiMixin ],
  data() {
    return {
      rootFolder: {},
      folderPath: '',
      activeTab: DEFAULT_TAB,
      files: [],
      selectedFile: {}
    };
  },
  computed: {
    sidebar() {
      if (this.notRegistered) {
        return false;
      }
      return this.activeTab !== 'drive_logs';
    },
    jobs() {
      return this.$root.jobs || [];
    },
    active_jobs() {
      return this.jobs.filter(job => ['waiting', 'running'].includes(job.state));
    },
  },
  created() {
    this.fetch();
    this.rootFolder = this.$root.drive;
  },
  watch: {
    async $route() {
      await this.fetch();
      this.activeTab = this.$route.hash.replace(/^#/, '') || DEFAULT_TAB;
    },
    async active_jobs() {
      console.log(JSON.stringify(this.jobs));
      await this.fetch();
    }
  },
  mounted() {
    this.activeTab = this.$route.hash.replace(/^#/, '') || DEFAULT_TAB;
  },
  methods: {
    async fetchFolder(driveId, filePath) {
      const pathContent = await this.FileClientService.getFile('/' + driveId + filePath);
      this.folderPath = filePath;
      this.files = pathContent.files || [];
    },
    async fetch() {
      const filePath = this.$route.path.substring('/drive'.length);

      const parts = filePath.split('/').filter(s => s.length > 0);
      const driveId = parts.shift();
      const baseName = parts.pop() || '';

      try {
        if (baseName.indexOf('.') > -1) {
          const dirPath = '/' + parts.join('/');
          await this.fetchFolder(driveId, dirPath);
          const file = this.files.find(f => f.fileName === baseName) || {};
          this.selectedFile = file || {};
        } else {
          parts.push(baseName);
          const dirPath = '/' + parts.join('/');
          await this.fetchFolder(driveId, dirPath);
          this.selectedFile = {};
        }
        this.notRegistered = false;
      } catch (err) {
        if (err.code === 404) {
          this.shareEmail = err.share_email;
          this.notRegistered = true;
        }
      }
    }
  }
};
</script>
