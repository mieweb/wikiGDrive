<template>
  <div>
    <ul class="mui-tabs__bar">
      <li :class="{ 'mui--is-active': activeTab === 'html' }" class="mui-tab__dropdown">
        <a @click.prevent.stop="setActiveTab('html')" data-mui-toggle="tab"><i class="fa-solid fa-eye"></i></a>
        <ul class="mui-dropdown__menu">
          <li><a @click.prevent.stop="setActiveTab('user_config')">Settings</a></li>
          <li v-if="htmlUrl"><a @click.prevent.stop="setActiveTab('markdown')">Markdown</a></li>
          <li v-if="selectedFile.fileId"><a @click.prevent.stop="downloadOdt(selectedFile.fileId)">Download odt</a></li>
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

    <div v-if="activeTab === 'markdown' && selectedFile.mimeType === 'text/x-markdown' && fileContent">
      <MarkDown>{{fileContent}}</MarkDown>
    </div>

    <div v-if="activeTab === 'html' && htmlUrl">
      <iframe :src="htmlUrl" style="width: 100%; border: 0; height: 100vh;"></iframe>
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
import MarkDown from './MarkDown.vue';
import GitCommit from './GitCommit.vue';
import UserConfig from './UserConfig.vue';
import GitLog from './GitLog.vue';
import BackLinks from './BackLinks.vue';

export default {
  name: 'FilePreview',
  mixins: [UtilsMixin, UiMixin],
  components: {
    GitLog,
    GitCommit,
    UserConfig,
    MarkDown,
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
      htmlUrl: '',
      fileContent: ''
    };
  },
  async created() {
    await this.fetchMarkdown();
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
    }
  },
  methods: {
    async fetchMarkdown() {
      this.fileContent = '';
      this.htmlUrl = '';
      if (this.selectedFile.mimeType.startsWith('text/')) {
        const fullUrl = '/' + this.driveId + this.folderPath + this.selectedFile.fileName;
        const file = await this.FileClientService.getFile(fullUrl);
        this.fileContent = file.content;
        this.htmlUrl = window.location.protocol + '//' + window.location.hostname + '/preview' +
            fullUrl
                .replace(/.md$/, '')
                .replace(/_index$/, '');
      }
    },
    setActiveTab(tab) {
      this.$router.replace({ hash: '#' + tab });
    },
    gotoFolder(folderId) {
      const routeUrl = this.$router.resolve({ name: 'folder', params: { driveId: this.driveId, folderId: folderId || this.driveId, fileId: this.selectedFile.id } });
      window.open(routeUrl.href, '_blank');
    },
    downloadOdt(fileId) {
      const odtPath = `/api/drive/${this.driveId}/file/${fileId}.odt`;
      window.open(odtPath, '_blank');
    }
  }
};
</script>
