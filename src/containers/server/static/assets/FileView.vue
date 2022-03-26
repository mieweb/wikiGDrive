<template>
  <BaseLayout :navbar="false">
    <template v-slot:default>
      <NotRegistered v-if="notRegistered" :share-email="shareEmail" />
      <div v-else>
        <FilePreview :activeTab="activeTab" :preview="preview" :git="git" @sync="syncSingle" @setup="gitSetup" @commit="commit" @push="push" :has-sync="true" />
      </div>
    </template>
  </BaseLayout>
</template>
<script lang="ts">
import BaseLayout from './BaseLayout.vue';
import {DEFAULT_TAB, UiMixin} from './UiMixin.mjs';
import {UtilsMixin} from './UtilsMixin.mjs';
import {GitMixin} from './GitMixin.mjs';
import FilePreview from './FilePreview.vue';
import NotRegistered from './NotRegistered.vue';

export default {
  name: 'FileView',
  mixins: [UtilsMixin, UiMixin, GitMixin],
  components: {
    FilePreview,
    BaseLayout,
    NotRegistered
  },
  data() {
    return {
      activeTab: DEFAULT_TAB,
      file: null,
      preview: {},
      git: {},
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
      this.preview = {};
      this.git = {};

      const fileId = this.$route.params.fileId;

      if (fileId) {
        const response = await fetch(`/api/drive/${this.driveId}/file/${fileId}`);
        this.preview = await response.json();
        this.git = this.preview.git;

        this.notRegistered = !!this.preview.not_registered;
        if (this.notRegistered) {
          this.shareEmail = this.preview.share_email;
          return;
        }
      }
    },
    async syncSingle() {
      if (this.preview.syncing) {
        return;
      }
      this.preview.syncing = true;
      const fileId = this.$route.params.fileId;
      try {
        await fetch(`/api/drive/${this.driveId}/sync/${fileId}`, {
          method: 'post'
        });
        await this.fetch();
      } finally {
      }
    },
    async runInspect() {
      try {
        const fileId = this.$route.params.fileId;

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

        const oldPreviewSyncing = this.preview.syncing;
        this.preview.syncing = (runningJob.type === 'sync_all');

        if (!this.preview.syncing) {
          const job = inspected.jobs.find(job => job.payload === fileId);
          this.preview.syncing = !!job || (runningJob.type === 'sync_all');
        }

        if (oldPreviewSyncing && !this.preview.syncing) {
          await this.fetch();
        }
      } catch (error404) {}
    }
  }
}
</script>
