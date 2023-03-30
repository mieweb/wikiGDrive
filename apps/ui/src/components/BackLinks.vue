<template>
  <div class="x-container">
    <h5>Back Links</h5>
    <table class="table table-hover table-clickable table-bordered table-layout-fixed" v-if="backlinks && backlinks.length > 0">
      <tbody>
      <tr v-for="(item, idx) of backlinks" :key="idx" @click="selectFile(item.path)">
        <td class="text-overflow" data-bs-toggle="tooltip" data-bs-placement="top" :title="item.path">
          <button class="btn btn-sm float-end" @click.prevent.stop="goToGDocs(item.fileId)"><i class="fa-brands fa-google-drive"></i></button>
          <span>{{item.path}}</span>
        </td>
      </tr>
      </tbody>
    </table>
    <div v-else>
      No BackLinks
    </div>
  </div>
</template>
<script>
import {UtilsMixin} from './UtilsMixin.ts';

export default {
  mixins: [UtilsMixin],
  props: {
    selectedFile: Object,
    contentDir: String
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
    async selectedFile(a, b) {
      if (a.id !== b.id || a.version !== b.version) {
        await this.fetch();
      }
    }
  },
  methods: {
    async fetch() {
      if (this.selectedFile.id) {
        this.backlinks = await this.FileClientService.getBacklinks(this.driveId, this.selectedFile.id);
      } else {
        this.backlinks = [];
      }
    },
    selectFile(path) {
      if (this.isAddon) {
        const routeData = this.$router.resolve('/drive/' + this.driveId + this.contentDir + path);
        window.open(routeData.href, '_blank');
      } else {
        this.$router.push('/drive/' + this.driveId + this.contentDir + path);
      }
    }
  }
};
</script>
