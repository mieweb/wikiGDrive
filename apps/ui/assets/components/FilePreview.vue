<template>
  <div>
    <PreviewHeader :selected-file="selectedFile" :active-tab="activeTab" :folder-path="folderPath" />

    <div v-if="activeTab === 'markdown' && selectedFile.mimeType === 'text/x-markdown' && fileContent">
      <MarkDown>{{fileContent}}</MarkDown>
    </div>

    <div v-if="activeTab === 'html' && selectedFile.previewUrl">
      <iframe :src="selectedFile.previewUrl + '?' + selectedFile.version" style="width: 100%; border: 0; height: calc(100vh - var(--navbar-height) );"></iframe>
    </div>

    <BackLinks v-if="activeTab === 'drive_backlinks'" :selectedFile="selectedFile" />
  </div>
</template>
<script>
import {UtilsMixin} from './UtilsMixin.mjs';
import {UiMixin} from './UiMixin.mjs';
import MarkDown from './MarkDown.vue';
import BackLinks from './BackLinks.vue';
import PreviewHeader from './PreviewHeader.vue';

export default {
  name: 'FilePreview',
  mixins: [UtilsMixin, UiMixin],
  components: {
    MarkDown,
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
        this.htmlUrl = file.previewUrl;
      }
    }
  }
};
</script>
