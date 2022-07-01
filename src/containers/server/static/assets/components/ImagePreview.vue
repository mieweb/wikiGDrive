<template>
  <div>
    <div v-if="activeTab === 'markdown' && imagePath">
      <div v-if="svgContent" v-html="svgContent" ></div>
      <img v-else :src="imagePath" />
    </div>

    <div v-if="activeTab === 'html' && htmlUrl">
      <iframe :src="htmlUrl" style="width: 100%; border: 0; height: calc(100vh - var(--navbar-height) );"></iframe>
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
    folderPath: {
      type: String
    },
    selectedFile: Object
  },
  data() {
    return {
      htmlUrl: '',
      svgContent: ''
    };
  },
  async created() {
    await this.fetchImage();
  },
  watch: {
    async selectedFile() {
      await this.fetchImage();
    }
  },
  computed: {
    drive() {
      return this.$root.drive || {};
    },
    imagePath() {
      const fullUrl = '/api/file/' + this.driveId + this.folderPath + this.selectedFile.fileName;
      return fullUrl;
    }
  },
  methods: {
    async fetchImage() {
      this.svgContent = '';
      this.htmlUrl = '';
      if ('image/svg+xml' === this.selectedFile.mimeType) {
        const folderPath = this.folderPath.endsWith('/') ? this.folderPath : this.folderPath + '/';
        const fullUrl = '/' + this.driveId + folderPath + this.selectedFile.fileName;
        const file = await this.FileClientService.getFile(fullUrl);
        this.svgContent = file.content;
        this.htmlUrl = window.location.protocol + '//' + window.location.hostname + '/preview' +
            (this.drive.hugo_theme?.id ? `/${this.drive.hugo_theme?.id}` : '') +
            fullUrl
                .replace(/.md$/, '')
                .replace(/_index$/, '');      }
    }
  }
};
</script>
