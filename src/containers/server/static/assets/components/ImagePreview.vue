<template>
  <div>
    <ul class="mui-tabs__bar">
      <li :class="{ 'mui--is-active': activeTab === 'html' }" class="mui-tab__dropdown">
        <a @click.prevent.stop="setActiveTab('html')" data-mui-toggle="tab"><i class="fa-solid fa-eye"></i></a>
        <ul class="mui-dropdown__menu">
          <li><a @click.prevent.stop="setActiveTab('user_config')">Settings</a></li>
          <li v-if="selectedFile.fileId"><a @click.prevent.stop="downloadImage(selectedFile.fileId)">Download file</a></li>
        </ul>
      </li>
      <li :class="{ 'mui--is-active': activeTab === 'drive' }" class="mui-tab__dropdown">
        <a><i class="fa-brands fa-google-drive"></i></a>
        <ul class="mui-dropdown__menu">
          <li v-if="isSinglePreview"><a @click.prevent.stop="goToPath(folderPath, '_blank')">WikiGDrive Folder</a></li>
          <li v-if="selectedFile.folderId"><a @click.prevent.stop="goToGDrive(selectedFile.folderId)">Google Drive</a></li>
          <li v-if="selectedFile.fileId"><a @click.prevent.stop="goToGDocs(selectedFile.fileId)">Google Docs</a></li>
          <li><a @click.prevent.stop="setActiveTab('drive_backlinks')">BackLinks</a></li>
          <li v-if="drive.tocFilePath"><a @click.prevent.stop="goToPath(drive.tocFilePath)">TOC</a></li>
          <li v-if="drive.navFilePath"><a @click.prevent.stop="goToPath(drive.navFilePath)">Navigation</a></li>
        </ul>
      </li>
      <li :class="{ 'mui--is-active': activeTab.startsWith('git_') }" class="mui-tab__dropdown">
        <a @click.prevent.stop="setActiveTab('git_log')" data-mui-toggle="tab">
          <i class="fa-brands fa-git-square"></i>
        </a>
        <ul class="mui-dropdown__menu">
          <li v-if="github_url"><a @click.prevent.stop="openWindow(github_url)">GitHub</a></li>
          <li v-if="gitInitialized"><a @click.prevent.stop="setActiveTab('git_commit')">Commit</a></li>
          <li v-if="gitInitialized"><a @click.prevent.stop="setActiveTab('git_log')">History</a></li>
        </ul>
      </li>
      <li :class="{ 'mui--is-active': activeTab === 'sync' }" class="mui-tab__dropdown">
        <a v-if="selectedFile.syncing">
          <i class="fa-solid fa-rotate fa-spin"></i>
        </a>
        <a v-else>
          <i class="fa-solid fa-rotate"></i>
        </a>
        <ul class="mui-dropdown__menu">
          <li><a @click.prevent="$emit('sync')">Sync single</a></li>
        </ul>
      </li>
    </ul>
    <div v-if="activeTab === 'markdown' && imagePath">
      <div v-if="svgContent" v-html="svgContent" ></div>
      <img v-else :src="imagePath" />
    </div>

    <BackLinks v-if="activeTab === 'drive_backlinks'" :selectedFile="selectedFile" />
    <GitLog v-if="activeTab === 'git_log'" :folderPath="folderPath" :selectedFile="selectedFile" />
    <UserConfig v-if="activeTab === 'user_config'" />
    <GitCommit v-if="activeTab === 'git_commit'" />
  </div>
</template>
<script>
import {UtilsMixin} from './UtilsMixin.mjs';
import {UiMixin} from './UiMixin.mjs';
import GitCommit from './GitCommit.vue';
import UserConfig from './UserConfig.vue';
import GitLog from './GitLog.vue';
import BackLinks from './BackLinks.vue';

export default {
  name: 'ImagePreview',
  mixins: [UtilsMixin, UiMixin],
  components: {
    GitLog,
    GitCommit,
    UserConfig,
    BackLinks
  },
  props: {
    activeTab: {
      type: String
    },
    hasSync: {
      type: Boolean,
      default: false
    },
    folderPath: {
      type: String
    },
    selectedFile: Object
  },
  data() {
    return {
      svgContent: ''
    };
  },
  async created() {
    await this.fetchImage();
  },
  watch: {
    async selectedFile() {
      await this.fetchMarkdown();
    }
  },
  computed: {
    drive() {
      return this.$root.drive || {};
    },
    isSinglePreview() {
      return this.$route.name === 'gdocs';
    },
    imagePath() {
      const fullUrl = '/api/file/' + this.driveId + this.folderPath + this.selectedFile.fileName;
      return fullUrl;
    }
  },
  methods: {
    async fetchImage() {
      if ('image/svg+xml' === this.selectedFile.mimeType) {
        const fullUrl = '/' + this.driveId + this.folderPath + this.selectedFile.fileName;
        const file = await this.FileClientService.getFile(fullUrl);
        this.svgContent = file.content;
      }
    },
    setActiveTab(tab) {
      this.$router.replace({ hash: '#' + tab });
    },
    gotoFolder(folderId) {
      const routeUrl = this.$router.resolve({ name: 'folder', params: { driveId: this.driveId, folderId: folderId || this.driveId, fileId: this.$route.params.fileId } });
      window.open(routeUrl.href, '_blank');
    },
    downloadImage(fileId) {
      const odtPath = `/api/drive/${this.driveId}/transformed/${fileId}`;
      window.open(odtPath, '_blank');
    }
  }
};
</script>
