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
      <tr v-if="folderPath !== '/'" @click="selectFile('..')">
        <td><i class="fa-solid fa-folder"></i></td>
        <td>
          ..
        </td>
        <td></td>
        <td></td>
      </tr>
      <tr v-for="file in files" :key="file.fileName" @click="selectFile(file.local.fileName)" :class="{'mui-tr--selected': file.local && file.local.fileName === selectedName}">
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
          #{{ file.local.version }}
          <i class="fa-solid fa-rotate" :class="{'fa-spin': file.syncing}"></i>
        </td>
        <td>{{ file.local.modifiedTime }}</td>
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
    folderPath: {
      type: String
    },
    files: {
      type: Array
    },
    notRegistered: {
      type: Boolean
    }
  },
  computed: {
    selectedName() {
      const driveId = this.$root.drive.id;
      if (this.folderPath === '/') {
        return this.$route.path.replace(`/drive/${driveId}${this.folderPath}`, '');
      }
      return this.$route.path.replace(`/drive/${driveId}${this.folderPath}/`, '');
    }
  },
  methods: {
    selectFile(fileName) {
      const parts = this.folderPath.split('/').filter(s => s.length > 0);
      if (fileName === '..') {
        parts.pop();
      } else  {
        parts.push(fileName);
      }
      this.goToPath(`/${parts.join('/')}`);
    }
  }
};
</script>
