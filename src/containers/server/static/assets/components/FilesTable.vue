<template>
  <table class="mui-table mui-table--bordered mui-table--hover mui-table--clickable" v-if="!notRegistered && files.length > 0">
    <thead>
      <tr>
        <th></th>
        <th>File</th>
        <th>Ver</th>
        <th>Modified</th>
        <th></th>
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
      <tr v-for="file in files" :key="file.fileName" @click="selectFile(file.local)" :class="{'mui-tr--selected': file.google && file.google.id === $route.params.fileId}">
        <td>
          <i class="fa-solid fa-folder" v-if="isFolder(file.google)"></i>
          <i class="fa-solid fa-file-image" v-else-if="isImage(file.google)"></i>
          <i class="fa-solid fa-file-lines" v-else-if="isDocument(file.google) || isMarkdown(file.local)"></i>
          <i v-else class="fa-solid fa-file"></i>
        </td>
        <td>
          {{ file.google ? file.google.name : '' }}<br/>
          {{ file.local ? file.local.fileName : '' }}
        </td>
        <td @click.stop="sync(file)">
          #{{ file.local ? file.local.version : '' }}
          <i class="fa-solid fa-rotate" :class="{'fa-spin': file.syncing}"></i>
        </td>
        <td>{{ file.google ? file.google.modifiedTime : '' }}</td>
        <td v-if="file.google" @click.stop="goToGDocs(file.google.id)"><i class="fa-brands fa-google-drive"></i></td>
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
    selectFile(localFile) {
      console.log('localFile', localFile);
      const folderId = this.$route.params.folderId;
      if (this.isFolder(localFile)) {
        console.log('FOLDER', localFile, localFile.mimeType, localFile.id);
        this.$router.push({ name: 'folder', params: { driveId: this.driveId, folderId: localFile.id } });
      } else
      if (this.isMarkdown(localFile)) {
        console.log('DOC', { driveId: this.driveId, folderId: folderId || this.driveId, fileId: localFile.id });
        this.$router.push({ name: 'folder', params: { driveId: this.driveId, folderId: folderId || this.driveId, fileId: localFile.id } });
      } else
      if (this.isImage(localFile)) {
        this.$router.push({ name: 'folder', params: { driveId: this.driveId, folderId: folderId || this.driveId, fileId: localFile.id } });
      }
    }
  }
};
</script>
