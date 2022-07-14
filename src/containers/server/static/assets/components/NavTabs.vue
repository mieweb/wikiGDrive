<template>
  <ul class="nav h-100">
    <li :class="{ 'active': activeTab === 'html' }" class="wgd-nav-item" v-if="isDocument(selectedFile) || isMarkdown(selectedFile) || isImage(selectedFile)">
      <a @click.prevent.stop="setActiveTab('html')">
        <i class="fa-solid fa-eye"></i>
      </a>
    </li>
    <li :class="{ 'active': activeTab.startsWith('drive_') }" class="wgd-nav-item">
      <a @click.prevent.stop="setActiveTab('drive_tools')">
        <i class="fa-brands fa-google-drive"></i>
      </a>
    </li>
    <li :class="{ 'active': activeTab.startsWith('git_') }" class="wgd-nav-item">
      <a @click.prevent.stop="setActiveTab('git_log')">
        <i class="fa-brands fa-git-square"></i>
      </a>
    </li>
    <li :class="{ 'active': activeTab === 'sync' }" class="wgd-nav-item">
      <a class="position-relative" @click.prevent.stop="setActiveTab('sync')">
        <i class="fa-solid fa-rotate" :class="{'fa-spin': syncing}"></i>
        <span class="position-absolute top-0 changes-badge translate-middle badge rounded-pill bg-danger" v-if="changes.length > 0">
           <span class="badge">{{changes.length}}</span>
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
    selectedFile: Object
  }
};
</script>
