<template>
  <div>
    <ul class="list-group">
      <li class="list-group-item" v-if="isGDocsPreview">
        <a :href="'/drive/' + driveId + folderPath" target="_blank">
          <i class="fa fa-arrow-up-right-from-square me-1"></i>
          WikiGDrive Folder
        </a>
      </li>
      <li class="list-group-item" v-if="selectedFile.parentId">
        <a :href="'https://drive.google.com/open?id=' + selectedFile.parentId" target="_blank">
          <i class="fa fa-arrow-up-right-from-square me-1"></i>
          Google Drive
        </a>
      </li>
      <li class="list-group-item" v-if="selectedFile.id">
        <a :href="'https://drive.google.com/open?id=' + selectedFile.id" target="_blank">
          <i class="fa fa-arrow-up-right-from-square me-1"></i>
          Google Docs
        </a>
      </li>
      <li class="list-group-item" v-if="drive.tocFilePath">
        <a @click.prevent.stop="goToPath(drive.tocFilePath)">
          <i class="fa-solid fa-list-ol me-1"></i>
          TOC
        </a>
      </li>
      <li class="list-group-item" v-if="drive.navFilePath">
        <a @click.prevent.stop="goToPath(drive.navFilePath)">
          <i class="fa-solid fa-compass me-1"></i>
          Navigation
        </a>
      </li>
      <li class="list-group-item" v-if="!isGDocsPreview">
        <router-link :to="{ name: 'drive', params: { driveId }, hash: '#drive_logs' }">
          <i class="fa-solid fa-computer me-1"></i>
          Logs
        </router-link>
      </li>
      <li class="list-group-item" v-if="!isGDocsPreview">
        <router-link :to="{ name: 'drive', params: { driveId }, hash: '#drive_config' }">
          <i class="fa-solid fa-gear me-1"></i>
          Settings
        </router-link>
      </li>
    </ul>
  </div>
</template>
<script>
import {UtilsMixin} from './UtilsMixin.mjs';
import {UiMixin} from './UiMixin.mjs';

export default {
  name: 'PreviewHeader',
  mixins: [UtilsMixin, UiMixin],
  props: {
    folderPath: {
      type: String
    },
    activeTab: {
      type: String
    },
    selectedFile: Object
  }
};
</script>
