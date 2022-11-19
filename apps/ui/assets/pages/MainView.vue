<template>
  <BaseLayout>
    <template v-slot:default>
      <div class="container">
        <form @submit.prevent.stop="submit">
          <legend>Share</legend>
          <div class="input-group">
            <input class="form-control" v-model="url" placeholder="https://drive.google.com/drive/u/0/folders/..." />
            <button type="submit" class="btn btn-primary">Share</button>
          </div>
        </form>

        <div v-if="loading" class="mt-3">
          <i class="fa-solid fa-rotate fa-spin"></i>
        </div>

        <div v-else-if="drivesShared && drivesShared.length > 0" class="mt-3">
          or select one of your drives
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

          <a v-if="drivesNotShared && drivesNotShared.length > 0" href="/drive">more...</a>
        </div>

        <div class="mt-3" v-else>
          or select one of your <a href="/drive">drives</a>
        </div>

      </div>
    </template>
  </BaseLayout>
</template>
<script>
import BaseLayout from '../layout/BaseLayout.vue';

export default {
  components: {
    BaseLayout
  },
  data() {
    return {
      url: '',
      drivesShared: [],
      drivesNotShared: [],
      loading: false
    };
  },
  async created() {
    await this.fetch();
  },
  methods: {
    async fetch() {
      this.loading = true;
      try {
        const drives = await this.DriveClientService.getDrives({ optional_login: true });
        this.drivesShared = drives.filter(d => !!d.exists);
        this.drivesNotShared = drives.filter(d => !d.exists);
      } finally {
        this.loading = false;
      }
    },
    selectDrive(driveId) {
      this.$router.push('/drive/' + driveId);
    },
    goToGDrive(folderId) {
      window.open('https://drive.google.com/drive/u/0/folders/' + folderId);
    },
    async submit() {
      const json = await this.authenticatedClient.fetchApi('/api/share_drive', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: this.url
        })
      });
      if (json.driveId) {
        await this.$router.push({ name: 'drive', params: { driveId: json.driveId } });
      } else {
        alert('Error sharing drive');
      }
    }
  }
};
</script>
