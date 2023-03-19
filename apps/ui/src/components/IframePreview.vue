<template>
  <div>
    <PreviewHeader :selected-file="selectedFile" :active-tab="activeTab" :folder-path="folderPath" />
    <iframe :src="imagePath" style="width: 100%; border: 0; height: calc(100vh - var(--navbar-height) );"></iframe>
  </div>
</template>
<script>
import {UtilsMixin} from './UtilsMixin.ts';
import {UiMixin} from './UiMixin.ts';
import PreviewHeader from './PreviewHeader.vue';

export default {
  name: 'IframePreview',
  mixins: [UtilsMixin, UiMixin],
  components: {
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
  computed: {
    drive() {
      return this.$root.drive || {};
    },
    imagePath() {
      return '/api/file/' + this.driveId + this.folderPath + '/' + this.selectedFile.fileName;
    }
  }
};
</script>
