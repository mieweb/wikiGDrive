<template>
  <BaseLayout :sidebar="false">
    <template v-slot:navbar>
      <div class="mui-container-fluid">
        <table style="width: 100%;">
          <tr class="mui--appbar-height">
            <td class="mui--text-title">
              WikiGDrive
            </td>
          </tr>
        </table>
      </div>
    </template>

    <template v-slot:default>
      <div class="mui-container">
        <table class="mui-table mui-table--bordered mui-table--hover mui-table--clickable" v-if="drives && drives.length > 0">
          <thead>
          <tr>
            <th>Name</th>
            <th>Id</th>
            <th></th>
          </tr>
          </thead>
          <tbody>
          <tr v-for="(item, idx) of drives" :key="idx" @click="selectDrive(item.folderId)">
            <td>{{item.name}}</td>
            <td>{{item.folderId}}</td>
            <td @click.stop="goToGDrive(item.folderId)"><i class="fa-brands fa-google-drive"></i></td>
          </tr>
          </tbody>
        </table>
      </div>
    </template>
  </BaseLayout>
</template>
<script>
import BaseLayout from '../layout/BaseLayout.vue';

export default {
  name: 'DrivesView',
  components: {
    BaseLayout,
  },
  data() {
    return {
      drives: []
    };
  },
  async created() {
    await this.fetch();
  },
  methods: {
    async fetch() {
      const response = await fetch('/api/ps');
      this.drives = await response.json();
    },
    open(url) {
      window.open(url, '_blank');
    },
    selectDrive(driveId) {
      this.$router.push({ name: 'folder', params: { driveId: driveId, folderId: driveId } });
    },
    goToGDrive(folderId) {
      window.open('https://drive.google.com/drive/u/0/folders/' + folderId);
    },
  }
};
</script>
