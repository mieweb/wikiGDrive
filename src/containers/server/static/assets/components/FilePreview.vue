<template>
  <div>
    <div v-if="activeTab === 'markdown' && selectedFile.mimeType === 'text/x-markdown' && fileContent">
      <MarkDown>{{fileContent}}</MarkDown>
    </div>

    <div v-if="activeTab === 'html' && htmlUrl">
      <iframe :src="htmlUrl + '?' + selectedFile.version" style="width: 100%; border: 0; height: calc(100vh - var(--navbar-height) );"></iframe>
    </div>

    <BackLinks v-if="activeTab === 'drive_backlinks'" :selectedFile="selectedFile" />
    <GitLog v-if="activeTab === 'git_log'" :folderPath="folderPath" :selectedFile="selectedFile" />
    <UserConfig v-if="activeTab === 'user_config'" />
    <LogsViewer v-if="activeTab === 'logs'" />
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
import LogsViewer from './LogsViewer.vue';

export default {
  name: 'FilePreview',
  mixins: [UtilsMixin, UiMixin],
  components: {
    GitLog,
    GitCommit,
    UserConfig,
    LogsViewer,
    MarkDown,
    BackLinks
  },
  props: {
    activeTab: {
      type: String
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
    }
  },
  methods: {
    async fetchMarkdown() {
      this.fileContent = '';
      this.htmlUrl = '';
      if (this.selectedFile.mimeType.startsWith('text/')) {
        const folderPath = this.folderPath.endsWith('/') ? this.folderPath : this.folderPath + '/';
        const fullUrl = '/' + this.driveId + folderPath + this.selectedFile.fileName;
        const file = await this.FileClientService.getFile(fullUrl);
        this.fileContent = file.content;

        const fullUrlPreview = '/' + this.driveId + (this.drive.hugo_theme?.id ? `/${this.drive.hugo_theme?.id}` : '') + folderPath + this.selectedFile.fileName;
        this.htmlUrl = window.location.protocol + '//' + window.location.hostname + '/preview' +
            fullUrlPreview
                .replace(/.md$/, '')
                .replace(/_index$/, '');
      }
    }
  }
};
</script>
