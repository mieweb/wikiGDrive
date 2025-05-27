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
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';


import {UtilsMixin} from './UtilsMixin.ts';
import {UiMixin} from './UiMixin.ts';
import PreviewHeader from './PreviewHeader.vue';

import {CoreEditor} from "@kerebron/editor";
import {ExtensionBasicEditor} from "@kerebron/extension-basic-editor";
import {ExtensionMarkdown} from '@kerebron/extension-markdown';
import {ExtensionYjs} from "@kerebron/extension-yjs";
import {NodeCodeMirror} from "@kerebron/extension-codemirror";
import {ExtensionMenu, MenuElement, MenuItem} from "@kerebron/extension-menu";
import {ExtensionTables} from '@kerebron/extension-tables';
import {ExtensionOdt} from '@kerebron/extension-odt';
import {SelectionExtension} from './SelectionExtension';
import {markRaw} from 'vue';
import AiModal from './AiModal.vue';

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
      selectionExtension: null,
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
      handler() {
        if (this.editor) {
          this.editor.setDocument(this.fileContent, 'application/vnd.oasis.opendocument.text');
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
  mounted() {
    const ydoc = new Y.Doc();
    this.ydoc = ydoc;

    const protocol = globalThis.location.protocol === 'http:' ? 'ws:' : 'wss:';

    if (this.roomId) {
      this.wsProvider = new WebsocketProvider(protocol + '//' + globalThis.location.host + '/yjs', this.roomId, ydoc);
    }

    this.selectionExtension = new SelectionExtension();

    const extensions = [
      new ExtensionBasicEditor(),
      this.selectionExtension,
      new ExtensionMenu({
        modifyMenu: (menus: MenuElement[][]) => {
          menus[0].push(new MenuItem({ label: 'AI', enable: () => true, run: () => this.ai() }));
          return menus;
        }
      }),
      new ExtensionMarkdown(),
      new ExtensionOdt(),
      new ExtensionTables(),
      new ExtensionYjs({ ydoc, provider: this.wsProvider }),
      new NodeCodeMirror({ ydoc, provider: this.wsProvider }),

      // new ExtensionBasicEditor(),
      // new ExtensionMarkdown(),
      // new NodeDocumentCode({ lang: String(this.lang) }),
      // new NodeCodeMirror({ ydoc, provider: this.wsProvider, languageWhitelist: [String(this.lang)], readOnly: this.readonly }),
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
      // topNode: 'doc_code',
      element: this.$refs.editor,
      extensions
    });

    this.editor.addEventListener('transaction', (ev: CustomEvent) => {
      this.$emit('update:modelValue', this.editor.getDocument('text/code-only'));
    });

    // this.editor.setDocument(this.innerValue, 'text/code-only');
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
    },
    ai() {
      const slice = this.selectionExtension.extractSelection();

      const editor2 = new CoreEditor({
        content: slice,
        extensions: [
          new ExtensionBasicEditor(),
          new ExtensionMarkdown(),
          new ExtensionOdt(),
          new ExtensionTables(),
          new NodeCodeMirror(),
        ],
      });

      this.$root.$addModal({
        component: markRaw(AiModal),
        props: {
          selection: editor2.getDocument('text/x-markdown')
        },
        events: {
          append: (answer) => {
            const doc2 = this.selectionExtension.extractSelection();

            const editor2 = new CoreEditor({
              content: doc2,
              extensions: [
                new ExtensionBasicEditor(),
                new ExtensionMarkdown(),
                new ExtensionOdt(),
                new ExtensionTables(),
                new NodeCodeMirror(),
              ],
            });

            editor2.setDocument(answer, 'text/x-markdown');

            this.selectionExtension.appendSelection(editor2.getDocument());
          },
          replace: (answer) => {
            const doc2 = this.selectionExtension.extractSelection();

            const editor2 = new CoreEditor({
              content: doc2,
              extensions: [
                new ExtensionBasicEditor(),
                new ExtensionMarkdown(),
                new ExtensionOdt(),
                new ExtensionTables(),
                new NodeCodeMirror(),
              ],
            });

            editor2.setDocument(answer, 'text/x-markdown');

            this.selectionExtension.replaceSelection(editor2.getDocument());
          },
        }
      });
    }
  }
};
</script>

<style>
.h-33 {
  max-height: 33%;
  overflow: scroll;
}
table {
  border: 1px solid red;
}
table th, table td {
  border: 1px solid red;
}

.ProseMirror {
  position: relative;
}

.ProseMirror {
  word-wrap: break-word;
  white-space: pre-wrap;
  -webkit-font-variant-ligatures: none;
  font-variant-ligatures: none;
}

.ProseMirror pre {
  white-space: pre-wrap;
}

.ProseMirror li {
  position: relative;
}

.ProseMirror-hideselection *::selection { background: transparent; }
.ProseMirror-hideselection *::-moz-selection { background: transparent; }
.ProseMirror-hideselection { caret-color: transparent; }

.ProseMirror-selectednode {
  outline: 2px solid #8cf;
}

/* Make sure li selections wrap around markers */

li.ProseMirror-selectednode {
  outline: none;
}

li.ProseMirror-selectednode:after {
  content: "";
  position: absolute;
  left: -32px;
  right: -2px; top: -2px; bottom: -2px;
  border: 2px solid #8cf;
  pointer-events: none;
}
.ProseMirror-textblock-dropdown {
  min-width: 3em;
}

.ProseMirror-menu {
  margin: 0 -4px;
  line-height: 1;
}

.ProseMirror-tooltip .ProseMirror-menu {
  width: -webkit-fit-content;
  width: fit-content;
  white-space: pre;
}

.ProseMirror-menuitem {
  margin-right: 3px;
  display: inline-block;
}

.ProseMirror-menuseparator {
  border-right: 1px solid #ddd;
  margin-right: 3px;
}

.ProseMirror-menu-dropdown, .ProseMirror-menu-dropdown-menu {
  font-size: 90%;
  white-space: nowrap;
}

.ProseMirror-menu-dropdown {
  vertical-align: 1px;
  cursor: pointer;
  position: relative;
  padding-right: 15px;
}

.ProseMirror-menu-dropdown-wrap {
  padding: 1px 0 1px 4px;
  display: inline-block;
  position: relative;
}

.ProseMirror-menu-dropdown:after {
  content: "";
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 4px solid currentColor;
  opacity: .6;
  position: absolute;
  right: 4px;
  top: calc(50% - 2px);
}

.ProseMirror-menu-dropdown-menu, .ProseMirror-menu-submenu {
  position: absolute;
  background: white;
  color: #666;
  border: 1px solid #aaa;
  padding: 2px;
}

.ProseMirror-menu-dropdown-menu {
  z-index: 15;
  min-width: 6em;
}

.ProseMirror-menu-dropdown-item {
  cursor: pointer;
  padding: 2px 8px 2px 4px;
}

.ProseMirror-menu-dropdown-item:hover {
  background: #f2f2f2;
}

.ProseMirror-menu-submenu-wrap {
  position: relative;
  margin-right: -4px;
}

.ProseMirror-menu-submenu-label:after {
  content: "";
  border-top: 4px solid transparent;
  border-bottom: 4px solid transparent;
  border-left: 4px solid currentColor;
  opacity: .6;
  position: absolute;
  right: 4px;
  top: calc(50% - 4px);
}

.ProseMirror-menu-submenu {
  display: none;
  min-width: 4em;
  left: 100%;
  top: -3px;
}

.ProseMirror-menu-active {
  background: #eee;
  border-radius: 4px;
}

.ProseMirror-menu-active {
  background: #eee;
  border-radius: 4px;
}

.ProseMirror-menu-disabled {
  opacity: .3;
}

.ProseMirror-menu-submenu-wrap:hover .ProseMirror-menu-submenu, .ProseMirror-menu-submenu-wrap-active .ProseMirror-menu-submenu {
  display: block;
}

.ProseMirror-menubar {
  border-top-left-radius: inherit;
  border-top-right-radius: inherit;
  position: relative;
  min-height: 1em;
  color: #666;
  padding: 1px 6px;
  top: 0; left: 0; right: 0;
  border-bottom: 1px solid silver;
  background: white;
  -moz-box-sizing: border-box;
  box-sizing: border-box;
  overflow: visible;
}

.ProseMirror-icon {
  display: inline-block;
  line-height: .8;
  vertical-align: -2px; /* Compensate for padding */
  padding: 2px 8px;
  cursor: pointer;
}

.ProseMirror-menu-disabled.ProseMirror-icon {
  cursor: default;
}

.ProseMirror-icon svg {
  fill: currentColor;
  height: 1em;
}

.ProseMirror-icon span {
  vertical-align: text-top;
}
.ProseMirror-gapcursor {
  display: none;
  pointer-events: none;
  position: absolute;
}

.ProseMirror-gapcursor:after {
  content: "";
  display: block;
  position: absolute;
  top: -2px;
  width: 20px;
  border-top: 1px solid black;
  animation: ProseMirror-cursor-blink 1.1s steps(2, start) infinite;
}

@keyframes ProseMirror-cursor-blink {
  to {
    visibility: hidden;
  }
}

.ProseMirror-focused .ProseMirror-gapcursor {
  display: block;
}
/* Add space around the hr to make clicking it easier */

.ProseMirror-example-setup-style hr {
  padding: 2px 10px;
  border: none;
  margin: 1em 0;
}

.ProseMirror-example-setup-style hr:after {
  content: "";
  display: block;
  height: 1px;
  background-color: silver;
  line-height: 2px;
}

.ProseMirror ul, .ProseMirror ol {
  padding-left: 30px;
}

.ProseMirror blockquote {
  padding-left: 1em;
  border-left: 3px solid #eee;
  margin-left: 0; margin-right: 0;
}

.ProseMirror-example-setup-style img {
  cursor: default;
}

.ProseMirror-prompt {
  background: white;
  padding: 5px 10px 5px 15px;
  border: 1px solid silver;
  position: fixed;
  border-radius: 3px;
  z-index: 11;
  box-shadow: -.5px 2px 5px rgba(0, 0, 0, .2);
}

.ProseMirror-prompt h5 {
  margin: 0;
  font-weight: normal;
  font-size: 100%;
  color: #444;
}

.ProseMirror-prompt input[type="text"],
.ProseMirror-prompt textarea {
  background: #eee;
  border: none;
  outline: none;
}

.ProseMirror-prompt input[type="text"] {
  padding: 0 4px;
}

.ProseMirror-prompt-close {
  position: absolute;
  left: 2px; top: 1px;
  color: #666;
  border: none; background: transparent; padding: 0;
}

.ProseMirror-prompt-close:after {
  content: "âœ•";
  font-size: 12px;
}

.ProseMirror-invalid {
  background: #ffc;
  border: 1px solid #cc7;
  border-radius: 4px;
  padding: 5px 10px;
  position: absolute;
  min-width: 10em;
}

.ProseMirror-prompt-buttons {
  margin-top: 5px;
  display: none;
}
#editor, .editor {
  background: white;
  color: black;
  background-clip: padding-box;
  border-radius: 4px;
  border: 2px solid rgba(0, 0, 0, 0.2);
  padding: 5px 0;
  margin-bottom: 23px;
}

.ProseMirror p:first-child,
.ProseMirror h1:first-child,
.ProseMirror h2:first-child,
.ProseMirror h3:first-child,
.ProseMirror h4:first-child,
.ProseMirror h5:first-child,
.ProseMirror h6:first-child {
  margin-top: 10px;
}

.ProseMirror {
  padding: 4px 8px 4px 14px;
  line-height: 1.2;
  outline: none;
}

.ProseMirror p { margin-bottom: 1em }

.codeblock-select {
  position: absolute;
  right: 0;
  z-index: 100;
  opacity: 0;
  transition: all 0.3s ease;
  margin: 6px 14px;
}

.codeblock-root {
  position: relative;
}

.codeblock-root:hover .codeblock-select {
  opacity: 1;
}







/* YJS */

/* this is a rough fix for the first cursor position when the first paragraph is empty */
.ProseMirror > .ProseMirror-yjs-cursor:first-child {
  margin-top: 16px;
}
.ProseMirror p:first-child, .ProseMirror h1:first-child, .ProseMirror h2:first-child, .ProseMirror h3:first-child, .ProseMirror h4:first-child, .ProseMirror h5:first-child, .ProseMirror h6:first-child {
  margin-top: 16px
}
/* This gives the remote user caret. The colors are automatically overwritten*/
.ProseMirror-yjs-cursor {
  position: relative;
  margin-left: -1px;
  margin-right: -1px;
  border-left: 1px solid black;
  border-right: 1px solid black;
  border-color: orange;
  word-break: normal;
  pointer-events: none;
}
/* This renders the username above the caret */
.ProseMirror-yjs-cursor > div {
  position: absolute;
  top: -1.05em;
  left: -1px;
  font-size: 13px;
  background-color: rgb(250, 129, 0);
  font-family: serif;
  font-style: normal;
  font-weight: normal;
  line-height: normal;
  user-select: none;
  color: white;
  padding-left: 2px;
  padding-right: 2px;
  white-space: nowrap;
}
</style>
