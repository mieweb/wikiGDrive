<template>
  <div class="form-control" ref="editor"></div>
</template>
<script lang="ts">
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

import {CoreEditor} from "@kerebron/editor";
import {ExtensionBasicEditor} from "@kerebron/extension-basic-editor";
import {ExtensionMarkdown} from '@kerebron/extension-markdown';
import {ExtensionYjs} from "@kerebron/extension-yjs";
import {NodeCodeMirror, NodeDocumentCode} from "@kerebron/extension-codemirror";

const usercolors = [
  { color: '#30bced', light: '#30bced33' },
  { color: '#6eeb83', light: '#6eeb8333' },
  { color: '#ffbc42', light: '#ffbc4233' },
  { color: '#ecd444', light: '#ecd44433' },
  { color: '#ee6352', light: '#ee635233' },
  { color: '#9ac2c9', light: '#9ac2c933' },
  { color: '#8acb88', light: '#8acb8833' },
  { color: '#1be7ff', light: '#1be7ff33' }
];

export default {
  name: 'CodeEditor',
  components: {},
  emits: ['update:modelValue'],
  props: {
    lang: {
      type: String,
      default: 'toml'
    },
    modelValue: {
      type: String
    },
    roomId: {
      type: String
    },
    readonly: {
      type: Boolean
    }
  },
  data() {
    return {
      user: {},
      editor: null,
      ydoc: {},
      innerValue: ''
    };
  },
  watch: {
    modelValue: {
      deep: true,
      handler() {
        this.innerValue = this.modelValue;
        if (this.editor) {
          this.editor.setDocument(this.innerValue, 'text/code-only');
        }
      }
    },
    user() {
      if (this.wsProvider) {
        const userColor = usercolors[Math.floor(Math.random() * usercolors.length)];
        this.wsProvider.awareness.setLocalStateField('user', {
          name: this.user.name || 'Anonymous ' + Math.floor(Math.random() * 100),
          color: userColor.color,
          colorLight: userColor.light
        });
      }
    }
  },
  async created() {
    this.innerValue = this.modelValue;
    const resUser = await this.authenticatedClient.fetchApi('/user/me');
    this.user = (await resUser.json())?.user || {};
  },
  beforeUnmount() {
    if (this.wsProvider) {
      this.wsProvider.awareness.setLocalStateField('user', undefined);
    }
  },
  mounted() {
    const ydoc = new Y.Doc();
    this.ydoc = ydoc;

    const protocol = globalThis.location.protocol === 'http:' ? 'ws:' : 'wss:';

    if (this.roomId) {
      this.wsProvider = new WebsocketProvider(protocol + '//' + globalThis.location.host + '/yjs', this.roomId, ydoc);
    }

    const extensions = [
      new ExtensionBasicEditor(),
      new ExtensionMarkdown(),
      new NodeDocumentCode({ lang: String(this.lang) }),
      new NodeCodeMirror({ ydoc, provider: this.wsProvider, languageWhitelist: [String(this.lang)], readOnly: this.readonly }),
    ];

    if (this.wsProvider) {
      this.wsProvider.on('status', event => {
        console.log('wsProvider status', event.status) // logs "connected" or "disconnected"
      });

      const userColor = usercolors[Math.floor(Math.random() * usercolors.length)];
      this.wsProvider.awareness.setLocalStateField('user', {
        name: this.user.name || 'Anonymous ' + Math.floor(Math.random() * 100),
        color: userColor.color,
        colorLight: userColor.light
      });
      extensions.push(new ExtensionYjs({ ydoc, provider: this.wsProvider }));
    }

    this.editor = new CoreEditor({
      topNode: 'doc_code',
      element: this.$refs.editor,
      extensions
    });

    this.editor.addEventListener('transaction', (ev: CustomEvent) => {
      this.$emit('update:modelValue', this.editor.getDocument('text/code-only'));
    });

    this.editor.setDocument(this.innerValue, 'text/code-only');
  }
};
</script>
