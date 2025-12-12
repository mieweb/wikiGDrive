<template>
  <div class="mainbar__content-height container">
    <PreviewHeader :selected-file="selectedFile" :active-tab="activeTab" :folder-path="folderPath" />

    <div v-if="activeTab === 'markdown' && selectedFile.mimeType === 'text/x-markdown' && fileContent">
      <MarkDown :abs-path="'/drive/' + driveId + folderPath" :modelValue="fileContent" />
    </div>

      <iframe v-if="activeTab === 'html' && selectedFile.previewUrl" :src="selectedFile.previewUrl + '?' + selectedFile.version" style="width: 100%; border: 0; height: calc(100vh - var(--navbar-height) );"></iframe>

    <BackLinks v-if="activeTab === 'drive_backlinks'" :selectedFile="selectedFile" :contentDir="contentDir" />
  </div>
</template>
<script>
import {UtilsMixin} from './UtilsMixin.ts';
import {UiMixin} from './UiMixin.ts';
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
    selectedFile: Object,
    contentDir: String
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
        const fullUrl = '/' + this.driveId + folderPath + (this.selectedFile.realFileName || this.selectedFile.fileName);
        const file = await this.FileClientService.getFile(fullUrl);
        this.fileContent = file.content;
        this.htmlUrl = file.previewUrl;
      }
    }
  }
};
</script>
