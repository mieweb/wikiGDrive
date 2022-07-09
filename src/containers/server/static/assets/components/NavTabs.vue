<template>
  <ul class="mui-tabs__bar nav-tabs">
    <li :class="{ 'nav-tab--active': activeTab === 'html' }" class="mui-tab__dropdown">
      <a @click.prevent.stop="setActiveTab('html')" data-mui-toggle="tab"><i class="fa-solid fa-eye"></i></a>
      <ul class="mui-dropdown__menu">
        <li><a @click.prevent.stop="setActiveTab('user_config')">Settings</a></li>
        <li><a @click.prevent.stop="setActiveTab('logs')">Logs</a></li>
        <li><a @click.prevent.stop="setActiveTab('markdown')">Markdown</a></li>
        <li v-if="selectedFile.id"><a @click.prevent.stop="downloadOdt(selectedFile.id)">Download odt</a></li>
        <li v-if="selectedFile.id"><a @click.prevent.stop="downloadImage(selectedFile.id)">Download image</a></li>
        <li><a @click.prevent.stop="setActiveTab('drive_backlinks')">BackLinks</a></li>
        <li v-if="drive.tocFilePath"><a @click.prevent.stop="goToPath(drive.tocFilePath)">TOC</a></li>
        <li v-if="drive.navFilePath"><a @click.prevent.stop="goToPath(drive.navFilePath)">Navigation</a></li>
      </ul>
    </li>
    <li :class="{ 'nav-tab--active': activeTab === 'drive' }" class="mui-tab__dropdown">
      <a><i class="fa-brands fa-google-drive"></i></a>
      <ul class="mui-dropdown__menu">
        <li v-if="isSinglePreview"><a @click.prevent.stop="goToPath(folderPath, '_blank')">WikiGDrive Folder</a></li>
        <li v-if="selectedFile.parentId"><a @click.prevent.stop="goToGDrive(selectedFile.parentId)">Google Drive</a></li>
        <li v-if="selectedFile.id"><a @click.prevent.stop="goToGDocs(selectedFile.id)">Google Docs</a></li>
      </ul>
    </li>
    <li :class="{ 'nav-tab--active': activeTab.startsWith('git_') }" class="mui-tab__dropdown">
      <a @click.prevent.stop="setActiveTab('git_log')" data-mui-toggle="tab">
        <i class="fa-brands fa-git-square"></i>
      </a>
      <ul class="mui-dropdown__menu">
        <li v-if="github_url"><a @click.prevent.stop="openWindow(github_url)">GitHub</a></li>
        <li v-if="gitInitialized"><a @click.prevent.stop="setActiveTab('git_commit')">Commit</a></li>
        <li v-if="gitInitialized"><a @click.prevent.stop="setActiveTab('git_log')">History</a></li>
      </ul>
    </li>
    <li :class="{ 'nav-tab--active': activeTab === 'sync' }" class="mui-tab__dropdown">
      <a>
        <i class="fa-solid fa-rotate" :class="{'fa-spin': syncing}"></i>
      </a>
      <ul class="mui-dropdown__menu" v-if="!syncing">
        <li v-if="selectedFile.id">
          <a @click.prevent="$emit('sync', selectedFile)">Sync single</a>
        </li>
        <li v-if="drive.name">
          <a @click.prevent="syncAll">Sync All</a>
        </li>
        <li v-if="last_job">
          <a @click.prevent>{{ last_job }}</a>
        </li>
      </ul>
      <ul class="mui-dropdown__menu" v-else>
        <li v-for="(job, idx) of active_jobs" :key="idx">
          <a>{{ job.title }}</a>
        </li>
      </ul>
    </li>
  </ul>
</template>
<script>
import {UtilsMixin} from './UtilsMixin.mjs';
import {UiMixin} from './UiMixin.mjs';

export default {
  name: 'NavTabs',
  mixins: [UtilsMixin, UiMixin],
  props: {
    activeTab: {
      type: String
    },
    folderPath: {
      type: String
    },
    selectedFile: Object
  },
  computed: {
    syncing() {
      return this.active_jobs.length > 0;
    },
    jobs() {
      return this.$root.jobs || [];
    },
    active_jobs() {
      return this.jobs.filter(job => ['waiting', 'running'].includes(job.state));
    },
    last_job() {
      if (this.selectedFile) {
        const fileJob = this.jobs.find(job => job.type === 'sync' && job.payload === this.selectedFile.id && ['done', 'failed'].includes(job.state));
        if (fileJob?.finished) {
          return 'Last file sync attempt ' + new Date(fileJob.finished).toISOString();
        }
      }

      const syncAllJob = this.jobs.find(job => job.type === 'sync_all' && ['done', 'failed'].includes(job.state));
      if (syncAllJob?.finished) {
        return 'Last full sync attempt ' + new Date(syncAllJob.finished).toISOString();
      }

      return '';
    },
    drive() {
      return this.$root.drive || {};
    },
    isSinglePreview() {
      return this.$route.name === 'gdocs';
    }
  },
  methods: {
    async syncAll() {
      await fetch(`/api/sync/${this.driveId}`, {
        method: 'post'
      });
    },
    downloadOdt(fileId) {
      const odtPath = `/api/drive/${this.driveId}/file/${fileId}.odt`;
      window.open(odtPath, '_blank');
    },
    downloadImage(fileId) {
      const odtPath = `/api/drive/${this.driveId}/transformed/${fileId}`;
      window.open(odtPath, '_blank');
    }
  }
};
</script>
