<template>
  <GitCommit v-if="activeTab === 'git_commit'" :folderPath="folderPath" :selectedFile="selectedFile" :active-tab="activeTab" />

  <BaseLayout v-else :sidebar="false" :share-email="shareEmail">
    <template v-slot:navbar>
      <NavBar :sidebar="false">
        <NavTabs :folder-path="folderPath" :activeTab="activeTab" :selectedFile="selectedFile" @sync="syncSingle" />
      </NavBar>
    </template>

    <template v-slot:default>
      <NotRegistered v-if="notRegistered" :share-email="shareEmail" />
      <div v-else>
        <ChangesViewer v-if="activeTab === 'sync'" :selected-file="selectedFile" :activeTab="activeTab" @sync="syncSingle" @transform="transformSingle" />
        <GitLog v-if="activeTab === 'git_log'" :folderPath="folderPath" :selectedFile="selectedFile" :active-tab="activeTab" />

        <DriveTools v-if="activeTab === 'drive_tools'" :folderPath="folderPath" :selectedFile="selectedFile" :selected-folder="selectedFolder" :active-tab="activeTab" />
        <LogsViewer v-if="activeTab === 'drive_logs'" />
        <UserConfig v-if="activeTab === 'drive_config'" />

        <div v-if="(activeTab === 'html' || activeTab === 'markdown' || activeTab === 'drive_backlinks') && selectedFile.mimeType === 'text/x-markdown'">
          <FilePreview :folder-path="folderPath" :activeTab="activeTab" :selectedFile="selectedFile" />
        </div>
        <div v-if="(activeTab === 'html' || activeTab === 'markdown' || activeTab === 'drive_backlinks') && selectedFile.mimeType === 'image/svg+xml'">
          <ImagePreview :folder-path="folderPath" :activeTab="activeTab" :selectedFile="selectedFile" />
        </div>
      </div>
    </template>
  </BaseLayout>
</template>
<script lang="js">
import BaseLayout from '../layout/BaseLayout.vue';
import {DEFAULT_TAB, UiMixin} from '../components/UiMixin.mjs';
import {UtilsMixin} from '../components/UtilsMixin.mjs';
import FilePreview from '../components/FilePreview.vue';
import ImagePreview from '../components/ImagePreview.vue';
import NotRegistered from './NotRegistered.vue';
import NavBar from '../components/NavBar.vue';
import NavTabs from '../components/NavTabs.vue';
import DriveTools from '../components/DriveTools.vue';
import LogsViewer from '../components/LogsViewer.vue';
import ChangesViewer from '../components/ChangesViewer.vue';
import UserConfig from '../components/UserConfig.vue';
import GitLog from '../components/GitLog.vue';
import GitCommit from '../components/GitCommit.vue';

export default {
  name: 'GDocsView',
  mixins: [UtilsMixin, UiMixin],
  components: {
    NavBar,
    NavTabs,
    FilePreview,
    ImagePreview,
    BaseLayout,
    NotRegistered,
    DriveTools,
    LogsViewer,
    ChangesViewer,
    UserConfig,
    GitLog,
    GitCommit
  },
  data() {
    return {
      activeTab: DEFAULT_TAB,
      folderPath: '',
      selectedFile: {},
      selectedFolder: {},
      notRegistered: false
    };
  },
  created() {
    this.fetch();
  },
  computed: {
    jobs() {
      return this.$root.jobs || [];
    },
    active_jobs() {
      return this.jobs.filter(job => ['waiting', 'running'].includes(job.state));
    }
  },
  watch: {
    async $route() {
      await this.fetch();
      this.activeTab = this.$route.hash.replace(/^#/, '') || DEFAULT_TAB;
    },
    async active_jobs() {
      await this.fetch();
    }
  },
  mounted() {
    this.activeTab = this.$route.hash.replace(/^#/, '') || DEFAULT_TAB;
  },
  methods: {
    async fetch() {
      await this.fetchFileById();
    },
    async fetchFileById() {
      const fileId = this.$route.params.fileId;

      if (fileId) {
        try {
          const response = await this.authenticatedClient.fetchApi(`/api/gdrive/${this.driveId}/${fileId}`);

          const path = response.headers.get('wgd-path') || '';
          const fileName = response.headers.get('wgd-file-name') || '';

          const contentDir = (response.headers.get('wgd-content-dir') || '/').replace(/\/$/, '');
          this.folderPath = contentDir + path.substring(0, path.length - fileName.length);
          this.selectedFile = {
            id: fileId,
            fileName,
            path,
            folderId: response.headers.get('wgd-google-parent-id'),
            version: response.headers.get('wgd-google-version'),
            modifiedTime: response.headers.get('wgd-google-modified-time'),
            fileId: response.headers.get('wgd-google-id'),
            mimeType: response.headers.get('wgd-mime-type'),
            previewUrl : response.headers.get('wgd-preview-url')
          };
          this.notRegistered = false;
        } catch (err) {
          if (err.code === 404) {
            this.shareEmail = err.share_email;
            this.notRegistered = true;
          }
        }
      }
    }
  }
};
</script>
