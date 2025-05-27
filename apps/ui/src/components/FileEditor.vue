<template>
  <div class="container mainbar__content-height">
    <PreviewHeader :selected-file="selectedFile" :active-tab="activeTab" :folder-path="folderPath" />
    <div class="card flex-grow-1 flex-shrink-1 overflow-scroll">
      <div class="card-body">
        <form>
          <CodeEditor v-model="fileContent" lang="text" :room-id="'file_' + selectedFile.id" />
        </form>
      </div>
    </div>
    <div>
      <br/>
      <button class="btn btn-primary" type="button" @click="save">Save</button>
    </div>
  </div>
</template>
<script>
import {UtilsMixin} from './UtilsMixin.ts';
import {UiMixin} from './UiMixin.ts';
import PreviewHeader from './PreviewHeader.vue';
import CodeEditor from './CodeEditor.vue';

export default {
  name: 'FileEditor',
  mixins: [UtilsMixin, UiMixin],
  components: {
    CodeEditor,
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
  computed: {
    drive() {
      return this.$root.drive || {};
    }
  },
  async created() {
    await this.fetchContent();
  },
  watch: {
    async selectedFile() {
      await this.fetchContent();
    }
  },
  methods: {
    async fetchContent() {
      this.fileContent = '';
      this.htmlUrl = '';
      if (this.selectedFile.mimeType.startsWith('text/')) {
        const folderPath = this.folderPath.endsWith('/') ? this.folderPath : this.folderPath + '/';
        const fullUrl = '/' + this.driveId + folderPath + (this.selectedFile.realFileName || this.selectedFile.fileName);
        const file = await this.FileClientService.getFile(fullUrl);
        this.fileContent = file.content;
        this.htmlUrl = file.previewUrl;
      }
    },
    async save() {
      if (!this.selectedFile.mimeType.startsWith('text/')) {
        return;
      }
      const folderPath = this.folderPath.endsWith('/') ? this.folderPath : this.folderPath + '/';
      const fullUrl = '/' + this.driveId + folderPath + (this.selectedFile.realFileName || this.selectedFile.fileName);
      await this.FileClientService.saveFile(fullUrl, this.fileContent);
    }
  }
};
</script>
