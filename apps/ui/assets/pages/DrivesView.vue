<template>
  <BaseLayout :sidebar="false">
    <template v-slot:default>
      <div class="container">
        <table class="table table-hover table-clickable" v-if="drives && drives.length > 0">
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
      this.drives = await this.DriveClientService.getDrives();
    },
    open(url) {
      window.open(url, '_blank');
    },
    selectDrive(driveId) {
      this.$router.push('/drive/' + driveId);
    },
    goToGDrive(folderId) {
      window.open('https://drive.google.com/drive/u/0/folders/' + folderId);
    },
  }
};
</script>
