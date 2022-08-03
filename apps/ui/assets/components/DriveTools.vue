<template>
  <div class="container mt-3">
    <ul class="list-group">
      <li class="list-group-item" v-if="isGDocsPreview">
        <a :href="'/drive/' + driveId + folderPath + (selectedFile ? selectedFile.fileName : '')" target="_blank">
          <i class="fa fa-arrow-up-right-from-square me-1"></i>
          WikiGDrive Folder
        </a>
      </li>

      <li class="list-group-item" v-if="selectedFolder.googleId">
        <a :href="'https://drive.google.com/open?id=' + selectedFolder.googleId" target="_blank">
          <i class="fa fa-arrow-up-right-from-square me-1"></i>
          Google Drive
        </a>
      </li>
      <li class="list-group-item" v-else-if="selectedFile.parentId">
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
    selectedFolder: Object,
    selectedFile: Object
  }
};
</script>
