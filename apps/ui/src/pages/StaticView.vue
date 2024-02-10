<template>
  <BaseLayout>
    <template v-slot:navbar="{ sidebar, collapsed, collapse }">
      <NavBar :sidebar="sidebar" :collapsed="collapsed" @collapse="collapse">
        <ul class="navbar-nav mr-auto align-items-center justify-content-start">
          <li class="nav-item">
            <a class="nav-link" :class="{'active': $route.path.startsWith('/docs')}" href="/docs">Documentation</a>
          </li>
          <li class="nav-item" v-if="isLogged">
            <a class="nav-link" :class="{'active': $route.path.startsWith('/drive')}" href="/drive">Drives</a>
          </li>
        </ul>
        <ul class="navbar-nav mr-auto align-items-center">
          <li>
            <button v-if="!isLogged" class="btn btn-secondary" @click="login">Sign in</button>
            <button v-if="isLogged" class="btn btn-secondary" @click="logout">Logout User</button>
          </li>
        </ul>
      </NavBar>
    </template>

    <template v-slot:default>
      <StaticContent />
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
