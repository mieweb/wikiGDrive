<template>
  <BaseLayout :sidebar="!notRegistered" :share-email="shareEmail">
    <template v-slot:navbar>
      <div class="mui-container-fluid">
        <table style="width: 100%;">
          <tr class="mui--appbar-height">
            <td class="mui--text-title" v-if="rootFolder.name">
              {{ rootFolder.name }}
            </td>
            <td class="mui--text-title" v-else>
              WikiGDrive
            </td>
            <td v-if="rootFolder.name">
              <button type="button" @click="syncAll" class="mui-btn mui-btn--small mui--pull-right"><i class="fa-solid fa-rotate" :class="{'fa-spin': rootFolder.syncing}"></i> Sync All</button>
            </td>
          </tr>
        </table>
      </div>
    </template>

    <template v-slot:sidebar>
      <FilesTable :parent-id="parentId" :files="files" :not-registered="notRegistered" />
    </template>
    <template v-slot:default>
      <NotRegistered v-if="notRegistered" />

      <div v-if="preview.mimeType === 'text/x-markdown'">
        <FilePreview :activeTab="activeTab" :preview="preview" :git="git" @setup="gitSetup" @commit="commit" @push="push" />
      </div>
      <div v-else>
        EEE
      </div>
    </template>
  </BaseLayout>
</template>
<script lang="ts">
import BaseLayout from './BaseLayout.vue';
import MarkDown from './MarkDown.vue';
import {DEFAULT_TAB, UiMixin} from './UiMixin.mjs';
import FilesTable from './FilesTable.vue';
import {UtilsMixin} from './UtilsMixin.mjs';
import NotRegistered from './NotRegistered.vue';
import {GitMixin} from './GitMixin.mjs';
import FilePreview from './FilePreview.vue';

export default {
  name: 'FolderView',
  components: {
    NotRegistered,
    FilesTable,
    MarkDown,
    BaseLayout,
    FilePreview
  },
  mixins: [ UtilsMixin, UiMixin, GitMixin ],
  data() {
    return {
      activeTab: DEFAULT_TAB,
      files: [],
      parentId: '',
      preview: {},
      git: {}
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
      this.files = [];
      this.parentId = '';
      this.preview = {};
      this.git = {};

      const folderId = this.$route.params.folderId;
      const fileId = this.$route.params.fileId;
      console.log('fffffffffff');
      const response = await fetch(`/api/drive/${this.driveId}` + (folderId && folderId !== this.driveId ? '/folder/' + folderId : ''));
      const json = await response.json();
      console.log('fffffffffff2', json);

      this.notRegistered = !!json.not_registered;
      if (this.notRegistered) {
        this.shareEmail = json.share_email;
        return;
      }

      this.files = json.files || [];
      this.parentId = json.parentId;
      this.rootFolder = json.rootFolder || {};
      this.preview = {};
      this.git = {};

      if (fileId) {
        const response = await fetch(`/api/drive/${this.driveId}/file/${fileId}`);
        this.preview = await response.json();
        console.log('preview', this.preview);
        this.git = this.preview.git;
      }
    },
    async syncAll() {
      this.rootFolder.syncing = true;
      try {
        await fetch(`/api/drive/${this.driveId}/sync`, {
          method: 'post'
        });
      } finally {
      }
    },
    async runInspect() {
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
      } catch (error404) {}
    }
  }
}
</script>
