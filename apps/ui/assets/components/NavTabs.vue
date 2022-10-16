<template>
  <ul class="navbar-nav mr-auto">
    <li :class="{ 'active': activeTab === 'html' || activeTab === 'markdown' }" class="wgd-nav-item"
        v-if="isDocument(selectedFile) || isMarkdown(selectedFile) || isImage(selectedFile)">
      <a @click.prevent.stop="setActiveTab('html')">
        <i class="fa-solid fa-eye"></i>
      </a>
    </li>
    <li :class="{ 'active': !activeTab }" class="wgd-nav-item"
        v-else-if="activeTab === 'git_commit'">
      <a @click.prevent.stop="setActiveTab('')">
        <i class="fa-solid fa-eye"></i>
      </a>
    </li>
    <li :class="{ 'active': !activeTab || activeTab === 'html' || activeTab === 'markdown' }" class="wgd-nav-item"
        v-else-if="selectedFolder">
      <a @click.prevent.stop="setActiveTab('')">
        <i class="fa-solid fa-eye"></i>
      </a>
    </li>
    <li v-if="isGDocsPreview" :class="{ 'active': activeTab.startsWith('drive_') }" class="wgd-nav-item">
      <a @click.prevent.stop="setActiveTab('drive_tools')">
        <i class="fa-brands fa-google-drive"></i>
      </a>
    </li>
    <li :class="{ 'active': activeTab.startsWith('git_') }" class="wgd-nav-item">
      <a class="position-relative" @click.prevent.stop="setActiveTab('git_commit')">
        <i class="fa-brands fa-git-square"></i>
        <span class="position-absolute top-0 changes-badge translate-middle badge rounded-pill bg-danger" v-if="gitStats.unstaged > 0">
           <span class="badge badge-primary" v-if="gitStats.unstaged">{{gitStats.unstaged}}</span>
        </span>
      </a>
    </li>
    <li :class="{ 'active': activeTab === 'sync' }" class="wgd-nav-item">
      <a class="position-relative" @click.prevent.stop="setActiveTab('sync')">
        <i class="fa-solid fa-rotate" :class="{'fa-spin': syncing}"></i>
        <span class="position-absolute top-0 changes-badge translate-middle badge rounded-pill bg-danger" v-if="fileChanges.length > 0">
           <span class="badge badge-primary">{{fileChanges.length}}</span>
        </span>
      </a>
    </li>
  </ul>
</template>
<script>
import {UtilsMixin} from './UtilsMixin.mjs';
import {UiMixin} from './UiMixin.mjs';

export default {
  name: 'NavTabs',
  mixins: [UtilsMixin, UiMixin],
  props: {
    activeTab: {
      type: String
    },
    folderPath: {
      type: String
    },
    selectedFile: Object,
    selectedFolder: Object
  },
  computed: {
    fileChanges() {
      return this.changes.filter(change => change.mimeType !== 'application/vnd.google-apps.folder');
    }
  }
};
</script>
