<template>
  <div class="mui-container">
    <table class="mui-table mui-table--bordered mui-table--hover mui-table--clickable" v-if="backlinks && backlinks.length > 0">
      <thead>
      <tr>
        <th>File</th>
      </tr>
      </thead>
      <tbody>
      <tr v-for="(item, idx) of backlinks" :key="idx" @click="selectFile(item.folderId, item.fileId)">
        <td>{{item.name}}</td>
      </tr>
      </tbody>
    </table>
  </div>
</template>
<script>
import {UtilsMixin} from './UtilsMixin.mjs';

export default {
  mixins: [UtilsMixin],
  props: {
    backlinks: Array
  },
  methods: {
    selectFile(folderId, fileId) {
      this.$router.push({ name: 'folder', params: { driveId: this.driveId, folderId: folderId || this.driveId, fileId: fileId } });
    }
  }
};
</script>
