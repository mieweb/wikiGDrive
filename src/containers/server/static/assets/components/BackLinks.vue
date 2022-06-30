<template>
  <div class="mui-container">
    <table class="mui-table mui-table--bordered mui-table--hover mui-table--clickable" v-if="backlinks && backlinks.length > 0">
      <thead>
      <tr>
        <th>File</th>
      </tr>
      </thead>
      <tbody>
      <tr v-for="(item, idx) of backlinks" :key="idx" @click="selectFile(item.path)">
        <td>{{item.name}}</td>
      </tr>
      </tbody>
    </table>
    <div v-else>
      No BackLinks
    </div>
  </div>
</template>
<script>
import {UtilsMixin} from './UtilsMixin.mjs';

export default {
  mixins: [UtilsMixin],
  props: {
    selectedFile: Object
  },
  data() {
    return {
      backlinks: []
    };
  },
  async created() {
    await this.fetch();
  },
  watch: {
    async selectedFile() {
      await this.fetch();
    }
  },
  methods: {
    async fetch() {
      this.backlinks = await this.FileClientService.getBacklinks(this.driveId, this.selectedFile.id);
    },
    selectFile(path) {
      console.log(this.driveId, path);
      this.$router.push('/drive/' + this.driveId + path);
    }
  }
};
</script>
