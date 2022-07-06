<template>
  <BaseLayout :sidebar="false" :share-email="shareEmail">
    <template v-slot:navbar>
      <nav>
        <NavTabs :folder-path="folderPath" :activeTab="activeTab" :selectedFile="selectedFile" @sync="syncSingle" />
      </nav>
    </template>

    <template v-slot:default>
      <NotRegistered v-if="notRegistered" :share-email="shareEmail" />
      <div v-else>
        <div v-if="selectedFile.mimeType === 'text/x-markdown'">
          <FilePreview :folder-path="folderPath" :activeTab="activeTab" :selectedFile="selectedFile" />
        </div>
        <div v-if="selectedFile.mimeType === 'image/svg+xml'">
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
import NavTabs from '../components/NavTabs.vue';

export default {
  name: 'GDocsView',
  mixins: [UtilsMixin, UiMixin],
  components: {
    NavTabs,
    FilePreview,
    ImagePreview,
    BaseLayout,
    NotRegistered
  },
  data() {
    return {
      activeTab: DEFAULT_TAB,
      folderPath: '',
      selectedFile: {},
      notRegistered: false
    };
  },
  created() {
    this.fetch();
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
    async fetch() {
      await this.fetchFileById();
    },
    async fetchFileById() {
      const fileId = this.$route.params.fileId;

      if (fileId) {
        const response = await fetch(`/api/gdrive/${this.driveId}/${fileId}`);

        const path = response.headers.get('wgd-path') || '';
        const fileName = response.headers.get('wgd-file-name') || '';
        this.folderPath = path.substring(0, path.length - fileName.length);
        this.selectedFile = {
          fileName,
          folderId: response.headers.get('wgd-google-parent-id'),
          fileId: response.headers.get('wgd-google-id'),
          mimeType: response.headers.get('wgd-mime-type')
        };
        console.log('selectedFile', this.selectedFile);

/*        this.notRegistered = !!this.preview.not_registered;
        if (this.notRegistered) {
          this.shareEmail = this.preview.share_email;
        }*/
      }
    },
    async runInspect() {
/*
      try {
        const response = await fetch(`/api/drive/${this.driveId}/inspect`);
        const inspected = await response.json();

        inspected.jobs = inspected.jobs || [];

        await this.onInspectResponse(inspected);
        // eslint-disable-next-line no-empty
      } catch (error404) {}
*/
    },
    async onInspectResponse(inspected) {
      const fileId = this.$route.params.fileId;

      let runningJob = {
        type: ''
      };
      if (inspected.jobs?.length) {
        if (inspected.jobs[0].state === 'running') {
          runningJob = inspected.jobs[0];
        }
      }

      const oldPreviewSyncing = this.preview.syncing;
      this.preview.syncing = (runningJob.type === 'sync_all');

      if (!this.preview.syncing) {
        const job = inspected.jobs.find(job => job.payload === fileId);
        this.preview.syncing = !!job || (runningJob.type === 'sync_all');
      }

      if (oldPreviewSyncing && !this.preview.syncing) {
        await this.fetch();
      }
    }
  }
};
</script>
