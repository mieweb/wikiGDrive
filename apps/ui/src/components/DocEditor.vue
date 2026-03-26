<template>
  <div class="container mainbar__content-height">
    <PreviewHeader :selected-file="selectedFile" :active-tab="activeTab" :folder-path="folderPath" />
    <div class="card flex-grow-1 flex-shrink-1 overflow-scroll">
      <div class="card-body">
        <form>
          <div class="form-control" ref="editor"></div>
        </form>
      </div>
    </div>
    <div>
      <br/>
      <button class="btn btn-primary" type="button" @click="save">Save</button>
    </div>
  </div>
</template>
<script lang="ts">
import {UtilsMixin} from './UtilsMixin.ts';
import {UiMixin} from './UiMixin.ts';
import PreviewHeader from './PreviewHeader.vue';

import {CoreEditor} from '@kerebron/editor';
import {AdvancedEditorKit} from '@kerebron/editor-kits/AdvancedEditorKit';

import '@kerebron/editor/assets/index.css';
import '@kerebron/editor-kits/assets/DevAdvancedEditorKit.css';
import '@kerebron/editor-kits/assets/AdvancedEditorKit.css';
import { createAssetLoad } from '@kerebron/wasm/web';

import {generateMD5Hash} from '../../../../src/utils/generateMD5Hash';

function getExt(fileName: string) {
  const idx = fileName.lastIndexOf('.');
  if (idx > -1) {
    return fileName.substring(idx);
  }
  return '';
}

export default {
  name: 'DocEditor',
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
      user: {},
      editor: null,
      extensionSelection: null,
      fileContent: ''
    };
  },
  computed: {
    drive() {
      return this.$root.drive || {};
    },
    roomId() {
      return 'googledoc_' + this.selectedFile.id;
    }
  },
  async created() {
    const resUser = await this.authenticatedClient.fetchApi('/user/me');
    this.user = (await resUser.json())?.user || {};
    await this.fetchContent();
  },
  beforeUnmount() {
    if (this.wsProvider) {
      this.wsProvider.awareness.setLocalStateField('user', undefined);
    }
  },
  watch: {
    async selectedFile() {
      await this.fetchContent();
    },
    fileContent: {
      deep: true,
      async handler() {
        if (this.editor) {
          await this.editor.loadDocument('application/vnd.oasis.opendocument.text', this.fileContent);
        }
      }
    },
  },
  mounted() {
    this.editor = CoreEditor.create({
      assetLoad: createAssetLoad(),
      element: this.$refs.editor,
      editorKits: [
        new AdvancedEditorKit(),
      ]
    });

    const extOdt = this.editor.getExtension('odt');
    extOdt.urlFromRewriter = async (href, ctx) => {
      if (ctx.type === 'IMG') {
        const file = ctx.filesMap[href];
        if (file) {
          const ext = getExt(href);
          if (ext) {
            const dir = this.selectedFile.previewUrl + '.assets/';
            href = dir + await generateMD5Hash(file) + ext;
          }
        }
      }
      return href;
    };
    console.log('extOdt', extOdt);

    this.extensionSelection = this.editor.getExtension('selection');

    this.editor.addEventListener('transaction', (ev: CustomEvent) => {
      this.$emit('update:modelValue', this.editor.getDocument('text/code-only'));
    });
  },
  methods: {
    async fetchContent() {
      if (!this.selectedFile?.id) {
        this.fileContent = null;
        return;
      }
      const odtPath = `/api/drive/${this.driveId}/file/${this.selectedFile.id}.odt`;
      const response = await fetch(odtPath);
      this.fileContent = await response.bytes();

      // this.htmlUrl = '';
      // if (this.selectedFile.mimeType.startsWith('text/')) {
      //   const folderPath = this.folderPath.endsWith('/') ? this.folderPath : this.folderPath + '/';
      //   const fullUrl = '/' + this.driveId + folderPath + (this.selectedFile.realFileName || this.selectedFile.fileName);
      //   const file = await this.FileClientService.getFile(fullUrl);
      //   this.htmlUrl = file.previewUrl;
      // }
    },
    async save() {
      alert('Not implemented!');
    }
  }
};
</script>
