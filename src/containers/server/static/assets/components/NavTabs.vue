<template>
  <ul class="mui-tabs__bar nav-tabs">
    <li :class="{ 'nav-tab--active': activeTab === 'html' }" class="mui-tab__dropdown">
      <a @click.prevent.stop="setActiveTab('html')" data-mui-toggle="tab"><i class="fa-solid fa-eye"></i></a>
      <ul class="mui-dropdown__menu">
        <li><a @click.prevent.stop="setActiveTab('user_config')">Settings</a></li>
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
        <li v-if="selectedFile.folderId"><a @click.prevent.stop="goToGDrive(selectedFile.folderId)">Google Drive</a></li>
        <li v-if="selectedFile.fileId"><a @click.prevent.stop="goToGDocs(selectedFile.fileId)">Google Docs</a></li>
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
        <li>
          <a @click.prevent="$emit('sync')">Sync single</a>
        </li>
        <li v-if="drive.name">
          <a @click.prevent="syncAll">Sync All</a>
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
      return this.drive.syncing || this.selectedFile.syncing;
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
