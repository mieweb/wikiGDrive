<template>
  <CodeEditor :modelValue="modelValue" lang="markdown" readOnly />
</template>
<script lang="ts">
import { CoreEditor } from '@kerebron/editor';
import { CodeEditorKit } from '@kerebron/editor-kits/CodeEditorKit';

import "@kerebron/editor/assets/index.css";
import '@kerebron/editor-kits/assets/CodeEditorKit.css';

import CodeEditor from './CodeEditor.vue';

export default {
  props: {
    absPath: {
      type: String
    },
    modelValue: {
      type: String
    }
  },
  components: { CodeEditor },
  data() {
    return {
      slotObserver: false,
    }
  },
  beforeUnmount() {
    if (this.slotObserver) {
      this.slotObserver.disconnect();
    }
  },
};
</script>
