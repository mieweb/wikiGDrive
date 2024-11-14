<template>
  <BaseLayout>
    <template v-slot:navbar="{ sidebar, collapsed, collapse }">
      <NavBar :sidebar="sidebar" :collapsed="collapsed" @collapse="collapse">
        <ul class="navbar-nav mr-auto align-items-center justify-content-start">
          <li class="nav-item">
            <router-link activeClass="active" class="nav-link" :to="{ name: 'docs' }">Documentation</router-link>
          </li>
          <li class="nav-item" v-if="isLogged">
            <router-link activeClass="active" class="nav-link" :to="{ name: 'drives' }">Drives</router-link>
          </li>
        </ul>
        <ul class="navbar-nav mr-auto align-items-center">
          <li v-if="afterFetch">
            <button v-if="!isLogged" class="btn btn-secondary" @click="login">Sign in</button>
            <button v-if="isLogged" class="btn btn-secondary" @click="logout">Logout User</button>
          </li>
        </ul>
      </NavBar>
    </template>

    <template v-slot:default>
      <LazyHydrate ssrOnly v-if="!content"></LazyHydrate>
      <div v-if="content" v-html="content"></div>
    </template>
  </BaseLayout>
</template>
<script>
import {markRaw} from 'vue';
import {UtilsMixin} from '../components/UtilsMixin';
import BaseLayout from '../layout/BaseLayout.vue';
import ShareModal from '../components/ShareModal.vue';
import NavBar from '../components/NavBar.vue';
import LazyHydrate from './LazyHydrate.vue';

export default {
  mixins: [ UtilsMixin ],
  components: {
    BaseLayout, NavBar, LazyHydrate
  },
  data() {
    return {
      url: '',
      drivesShared: [],
      drivesNotShared: [],
      loading: false,
      afterFetch: false,
      content: ''
    };
  },
  async created() {
    if (this.emitter) {
      this.emitter.on('html_lazy_content', (html) => {
        this.content = html;
      });
    }
    await this.fetch();
  },
  methods: {
    async fetch() {
      await this.$root.fetchUser();
      this.afterFetch = true;
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
