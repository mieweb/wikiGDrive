<template>
  <div class="container mt-3">
    <ul class="list-group">
      <li class="list-group-item" v-if="isGDocsPreview">
        <a :href="'/drive/' + driveId + folderPath + (selectedFile ? selectedFile.fileName : '')" target="_blank">
          <i class="fa fa-arrow-up-right-from-square me-1"></i>
          WikiGDrive Folder
        </a>
      </li>

      <li class="list-group-item" v-if="selectedFolder && selectedFolder.googleId">
        <a :href="'https://drive.google.com/open?id=' + selectedFolder.googleId" target="_blank">
          <i class="fa fa-arrow-up-right-from-square me-1"></i>
          Google Drive
        </a>
      </li>
      <li class="list-group-item" v-else-if="selectedFile && selectedFile.parentId">
        <a :href="'https://drive.google.com/open?id=' + selectedFile.parentId" target="_blank">
          <i class="fa fa-arrow-up-right-from-square me-1"></i>
          Google Drive
        </a>
      </li>

      <ToolButton
          v-if="github_url"
          :active="activeTab === 'git_hub'"
          :href="github_url"
          title="GitHub"
          icon="fa-brands fa-github"
      />

      <li class="list-group-item" v-if="selectedFile && selectedFile.id">
        <a :href="'https://drive.google.com/open?id=' + selectedFile.id" target="_blank">
          <i class="fa fa-arrow-up-right-from-square me-1"></i>
          Google Docs
        </a>
      </li>

      <li class="list-group-item" v-if="treeEmpty && !isGDocsPreview">
        Markdown tree empty
        <a class="btn btn-outline-secondary me-2" @click.prevent="syncAll">Sync All</a>
      </li>
      <li class="list-group-item" v-else-if="treeVersion && treeVersion !== GIT_SHA">
        Markdowns were generated with version: <em>{{treeVersion}}</em>.<br/>
        WikiGDrive is now running: <em>{{GIT_SHA}}</em>.<br/>
        <a class="btn btn-outline-secondary me-2" @click.prevent="transformAll">Update your entire tree now?</a>
      </li>
    </ul>
  </div>
</template>
<script>
import {UtilsMixin} from './UtilsMixin.ts';
import {UiMixin} from './UiMixin.ts';
import ToolButton from './ToolButton.vue';

export default {
  name: 'PreviewHeader',
  mixins: [UtilsMixin, UiMixin],
  components: {ToolButton},
  props: {
    treeEmpty: {
      type: Boolean,
      default: false
    },
    treeVersion: {
      type: String,
      default: null
    },
    folderPath: {
      type: String
    },
    activeTab: {
      type: String
    },
    selectedFolder: Object,
    selectedFile: Object
  },
  computed: {
    GIT_SHA() {
      return this.drive.GIT_SHA;
    }
  }
};
</script>
