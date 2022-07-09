<template>
  <BaseLayout :sidebar="!notRegistered" :share-email="shareEmail">
    <template v-slot:navbar>
      <nav>
        <span class="mui--text-title" v-if="rootFolder.name">
          {{ rootFolder.name }}
        </span>
        <span class="mui--text-title" v-else>
          WikiGDrive
        </span>

        <NavTabs :folder-path="folderPath" :activeTab="activeTab" :selectedFile="selectedFile" @sync="syncSingle" />
      </nav>
    </template>

    <template v-slot:sidebar>
      <FilesTable :folder-path="folderPath" :files="files" :not-registered="notRegistered" />
    </template>
    <template v-slot:default>
      <NotRegistered v-if="notRegistered" />

      <div v-if="selectedFile.mimeType === 'text/x-markdown'">
        <FilePreview :folder-path="folderPath" :activeTab="activeTab" :selectedFile="selectedFile" />
      </div>
      <div v-if="selectedFile.mimeType === 'image/svg+xml'">
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

export default {
  name: 'FolderView',
  components: {
    NavTabs,
    NotRegistered,
    FilesTable,
    BaseLayout,
    FilePreview,
    ImagePreview
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
      this.files = pathContent.files;
    },
    async fetch() {
      const filePath = this.$route.path.substring('/drive'.length);

      const parts = filePath.split('/').filter(s => s.length > 0);
      const driveId = parts.shift();
      const baseName = parts.pop() || '';
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
/*
      const parentId = this.$route.params.parentId;

      const response = await fetch(`/api/drive/${this.driveId}` + (folderId && folderId !== this.driveId ? '/folder/' + parentId : ''));
      const json = await response.json();
      console.log('Folder fetch', json);

      this.notRegistered = !!json.not_registered;
      if (this.notRegistered) {
        this.shareEmail = json.share_email;
        return;
      }
*/
    }
  }
};
</script>
