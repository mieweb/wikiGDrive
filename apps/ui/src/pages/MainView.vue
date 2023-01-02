<template>
  <BaseLayout>
    <template v-slot:navbar="{ sidebar, collapsed, collapse }">
      <NavBar :sidebar="sidebar" :collapsed="collapsed" @collapse="collapse">
        <ul class="navbar-nav mr-auto align-items-center">
          <li>
            <button v-if="!isLogged" class="btn btn-secondary" @click="login">Sign in</button>
            <button v-if="isLogged" class="btn btn-secondary" @click="logout">Logout User</button>
          </li>
        </ul>
      </NavBar>
    </template>

    <template v-slot:default>
      <div class="container">
        <div v-if="!isLogged">
          <StaticContent />
        </div>
        <div v-else>
          <div v-if="loading" class="mt-3">
            <i class="fa-solid fa-rotate fa-spin"></i>
          </div>

          <div v-else-if="drivesShared && drivesShared.length > 0" class="mt-3">
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
        </div>
      </div>
    </template>
  </BaseLayout>
</template>
<script>
import {markRaw} from 'vue';
import {UtilsMixin} from '../components/UtilsMixin';
import BaseLayout from '../layout/BaseLayout.vue';
import ShareModal from '../components/ShareModal.vue';
import StaticContent from '../components/StaticContent.vue';
import NavBar from '../components/NavBar.vue';
import {awaitValue} from '@swc/helpers';

export default {
  mixins: [ UtilsMixin ],
  components: {
    BaseLayout, StaticContent, NavBar
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
      await this.$root.fetchUser();
      if (!this.isLogged) {
        this.drivesShared = [];
        this.drivesNotShared = [];
        return;
      }

      this.loading = true;
      try {
        const drives = await this.DriveClientService.getDrives();
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
      try {
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
      } catch (err) {
        console.error(err);
      }
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
