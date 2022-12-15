<template>
  <BaseLayout :sidebar="false">
    <template v-slot:default>
      <div class="container">

        <div v-if="drivesShared && drivesShared.length > 0" class="mt-3">
          <h3>You have shared with wikigdrive:</h3>
          <table class="table table-hover table-clickable">
            <thead>
            <tr>
              <th>Name</th>
              <th>Id</th>
              <th></th>
            </tr>
            </thead>
            <tbody>
            <tr v-for="(item, idx) of drivesShared" :key="idx" @click="selectDrive(item.folderId)">
              <td>{{item.name}}</td>
              <td>{{item.folderId}}</td>
              <td @click.stop="goToGDrive(item.folderId)"><i class="fa-brands fa-google-drive"></i></td>
            </tr>
            </tbody>
          </table>
        </div>

        <div v-if="drivesNotShared && drivesNotShared.length > 0" class="mt-3">
          <h3>You also have few drives not shared with wikigdrive:</h3>
          <table class="table table-hover table-clickable">
            <thead>
            <tr>
              <th>Name</th>
              <th>Id</th>
              <th></th>
            </tr>
            </thead>
            <tbody>
            <tr v-for="(item, idx) of drivesNotShared" :key="idx" @click="selectDrive(item.folderId)">
              <td>{{item.name}}</td>
              <td>{{item.folderId}}</td>
              <td @click.stop="share(item.folderId)"><i class="fa fa-share"></i> Share</td>
            </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </BaseLayout>
</template>
<script>
import BaseLayout from '../layout/BaseLayout.vue';
import {markRaw} from 'vue';
import ShareModal from '../components/ShareModal.vue';

export default {
  name: 'DrivesView',
  components: {
    BaseLayout,
  },
  data() {
    return {
      drivesShared: [],
      drivesNotShared: []
    };
  },
  async created() {
    await this.fetch();
  },
  methods: {
    async fetch() {
      const drives = await this.DriveClientService.getDrives();
      this.drivesShared = drives.filter(d => !!d.exists);
      this.drivesNotShared = drives.filter(d => !d.exists);
    },
    selectDrive(driveId) {
      this.$router.push('/drive/' + driveId);
    },
    goToGDrive(folderId) {
      window.open('https://drive.google.com/drive/u/0/folders/' + folderId);
    },
    share(driveId) {
      this.$root.$addModal({
        component: markRaw(ShareModal),
        props: {
          driveId
        },
      });
    }
  }
};
</script>
