<template>
  <BaseLayout :navbar="false">
    <template v-slot:default>
      <NotRegistered v-if="notRegistered" :share-email="shareEmail" />
      <div v-else>
        <FilePreview :activeTab="activeTab" :preview="preview" :git="git" @sync="syncSingle" @commit="commit" @push="push" :has-sync="true" />
      </div>
    </template>
  </BaseLayout>
</template>
<script lang="ts">
import BaseLayout from '../layout/BaseLayout.vue';
import {DEFAULT_TAB, UiMixin} from '../components/UiMixin.mjs';
import {UtilsMixin} from '../components/UtilsMixin.mjs';
import {GitMixin} from '../components/GitMixin.mjs';
import FilePreview from '../components/FilePreview.vue';
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
      await this.fetchFile();
    },
    async runInspect() {
      try {
        const response = await fetch(`/api/drive/${this.driveId}/inspect`);
        const inspected = await response.json();

        inspected.jobs = inspected.jobs || [];

        await this.onInspectResponse(inspected);
        // eslint-disable-next-line no-empty
      } catch (error404) {}
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
