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
        <FilePreview :folder-path="folderPath" :activeTab="activeTab" :selectedFile="selectedFile" @sync="syncSingle" />
      </div>
      <div v-if="selectedFile.mimeType === 'image/svg+xml'">
        <ImagePreview :folder-path="folderPath" :activeTab="activeTab" :selectedFile="selectedFile" @sync="syncSingle" />
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
  created() {
    this.fetch();

    this.rootFolder = this.$root.drive;

    setInterval(() => {
      this.runInspect();
    }, 2000);
  },
  watch: {
    async $route() {
      await this.fetch();
      this.activeTab = this.$route.hash.replace(/^#/, '') || DEFAULT_TAB;
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
        const file = this.files.find(f => f.local?.fileName === baseName) || {};
        this.selectedFile = file.local || {};
      } else {
        parts.push(baseName);
        const dirPath = '/' + parts.join('/');
        await this.fetchFolder(driveId, dirPath);
        this.selectedFile = {};
      }
/*
      const folderId = this.$route.params.folderId;

      const response = await fetch(`/api/drive/${this.driveId}` + (folderId && folderId !== this.driveId ? '/folder/' + folderId : ''));
      const json = await response.json();
      console.log('Folder fetch', json);

      this.notRegistered = !!json.not_registered;
      if (this.notRegistered) {
        this.shareEmail = json.share_email;
        return;
      }
*/
    },
    async runInspect() {
/*
      try {
        const response = await fetch(`/api/drive/${this.driveId}/inspect`);
        const inspected = await response.json();

        inspected.jobs = inspected.jobs || [];

        let runningJob = {
          type: ''
        };
        if (inspected.jobs?.length) {
          if (inspected.jobs[0].state === 'running') {
            runningJob = inspected.jobs[0];
          }
        }

        const oldRootSyncing = this.rootFolder.syncing;
        this.rootFolder.syncing = (runningJob.type === 'sync_all');

        for (const file of this.files) {
          const job = inspected.jobs.find(job => job.payload === file.id);
          file.syncing = !!job || (runningJob.type === 'sync_all');
        }

        if (oldRootSyncing && !this.rootFolder.syncing) {
          this.refresh();
        }
        // eslint-disable-next-line no-empty
      } catch (error404) {}
*/
    }
  }
};
</script>
