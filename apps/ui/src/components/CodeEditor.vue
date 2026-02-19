<template>
  <div ref="editor" class="form-control"></div>
</template>
<script lang="ts">
import { CoreEditor } from '@kerebron/editor';
import { CodeEditorKit } from '@kerebron/editor-kits/CodeEditorKit';

import "@kerebron/editor/assets/index.css";
import '@kerebron/editor-kits/assets/CodeEditorKit.css';

export default {
  name: 'CodeEditor',
  emits: ['update:modelValue'],
  props: {
    readOnly: {
      type: Boolean,
      default: false
    },
    lang: {
      type: String,
      default: 'toml'
    },
    modelValue: {
      type: String
    }
  },
  data() {
    return {
      innerValue: '',
      editor: null
    };
  },
  async mounted() {
    this.editor = CoreEditor.create({
      cdnUrl: '/wasm/',
      uri: 'file:///test.md',
      topNode: 'doc_code',
      readOnly: this.readOnly,
      element: this.$refs.editor,
      editorKits: [
        new CodeEditorKit(this.lang),
      ]
    });

    await this.editor.loadDocument('text/code-only', new TextEncoder().encode(this.innerValue));

    this.editor.addEventListener('changed', async (ev) => { // TODO debounce?
      const buffer = await this.editor.saveDocument('text/code-only');
      this.$emit('update:modelValue', new TextDecoder().decode(buffer));
    });
  },
  watch: {
    modelValue: {
      deep: true,
      async handler() {
        this.innerValue = this.modelValue;
        await this.editor.loadDocument('text/code-only', new TextEncoder().encode(this.innerValue));
      }
    }
  },
  created() {
    this.innerValue = this.modelValue;
  },
  methods: {
    async init() {
    }
  }
};
</script>
