<template>
  <div>
    <PreviewHeader :selected-file="selectedFile" :active-tab="activeTab" :folder-path="folderPath" />

    <div v-if="activeTab === 'markdown' && imagePath">
      <div v-if="svgContent" v-html="svgContent" ></div>
      <img v-else :src="imagePath" :alt="selectedFile.name" />
    </div>

    <div v-if="activeTab === 'html' && htmlUrl">
      <iframe :src="htmlUrl + '?' + selectedFile.version" style="width: 100%; border: 0; height: calc(100vh - var(--navbar-height) );"></iframe>
    </div>

    <BackLinks v-if="activeTab === 'drive_backlinks'" :selectedFile="selectedFile" />
  </div>
</template>
<script>
import {UtilsMixin} from './UtilsMixin.mjs';
import {UiMixin} from './UiMixin.mjs';
import BackLinks from './BackLinks.vue';
import PreviewHeader from './PreviewHeader.vue';

export default {
  name: 'ImagePreview',
  mixins: [UtilsMixin, UiMixin],
  components: {
    BackLinks,
    PreviewHeader
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
      return '/api/file/' + this.driveId + this.folderPath + this.selectedFile.fileName;
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

        const fullUrlPreview = '/' + this.driveId + (this.drive.hugo_theme?.id ? `/${this.drive.hugo_theme?.id}` : '') + folderPath + this.selectedFile.fileName;
        this.htmlUrl = window.location.protocol + '//' + window.location.hostname + '/preview' +
            fullUrlPreview
                .replace(/.md$/, '')
                .replace(/_index$/, '');      }
    }
  }
};
</script>
