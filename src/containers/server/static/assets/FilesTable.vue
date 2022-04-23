<template>
  <table class="mui-table mui-table--bordered mui-table--hover mui-table--clickable" v-if="!notRegistered && files.length > 0">
    <thead>
      <tr>
        <th></th>
        <th>File</th>
        <th>Ver</th>
        <th>Modified</th>
      </tr>
    </thead>
    <tbody>
      <tr v-if="parentId" @click="selectFile({ id: parentId, mimeType: 'application/vnd.google-apps.folder' })">
        <td><i class="fa-solid fa-folder"></i></td>
        <td>
          ..
        </td>
        <td></td>
        <td></td>
      </tr>
      <tr v-for="file in files" :key="file.google.id" @click="selectFile(file.google)">
        <td>
          <i class="fa-solid fa-folder" v-if="isFolder(file.google)"></i>
          <i class="fa-solid fa-file-image" v-else-if="isImage(file.google)"></i>
          <i class="fa-solid fa-file-lines" v-else-if="isDocument(file.google)"></i>
          <i v-else class="fa-solid fa-file"></i>
        </td>
        <td>
          {{ file.google.name }}<br/>
          {{ file.local ? file.local.fileName : '' }}
        </td>
        <td @click.stop="sync(file)">
          #{{ file.local ? file.local.version : '' }}
          <i class="fa-solid fa-rotate" :class="{'fa-spin': file.syncing}"></i>
        </td>
        <td>{{ file.google.modifiedTime }}</td>
        <td @click.stop="goToGDrive(file.google)"><i class="fa-brands fa-google-drive"></i></td>
      </tr>
    </tbody>
  </table>
</template>
<script>
import {UtilsMixin} from './UtilsMixin.mjs';

export default {
  mixins: [ UtilsMixin ],
  props: {
    parentId: {
      type: String
    },
    files: {
      type: Array
    },
    notRegistered: {
      type: Boolean
    }
  },
  methods: {
    selectFile(googleFile) {
      const folderId = this.$route.params.folderId;
      if (this.isFolder(googleFile)) {
        console.log('FOLDER', googleFile, googleFile.mimeType, googleFile.id);
        this.$router.push({ name: 'folder', params: { driveId: this.driveId, folderId: googleFile.id } });
      } else
      if (this.isDocument(googleFile)) {
        console.log('DOC', { driveId: this.driveId, folderId: folderId || this.driveId, fileId: googleFile.id });
        this.$router.push({ name: 'folder', params: { driveId: this.driveId, folderId: folderId || this.driveId, fileId: googleFile.id } });
      }
    }
  }
};
</script>
