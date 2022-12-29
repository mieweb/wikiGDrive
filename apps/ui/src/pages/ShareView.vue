<template>
  <div class="d-flex h-100 align-items-center justify-content-center">
    <button @click="share" class="btn btn-secondary">Opening share dialog...</button>
  </div>
</template>
<script>
import {UtilsMixin} from '../components/UtilsMixin.ts';

await import('https://apis.google.com/js/api.js');

export default {
  name: 'ShareView',
  mixins: [UtilsMixin],
  data() {
    return {
      google_access_token: null,
      share_email: null
    };
  },
  async mounted() {
    const response = await this.authenticatedClient.fetchApi('/api/share-token', { method: 'post'});
    const json = await response.json();
    this.google_access_token = json.google_access_token;
    this.share_email = json.share_email;
    this.share();
  },
  methods: {
    share() {
      if (!this.google_access_token) {
        return;
      }
      const driveId = this.$route.params.driveId
          .replace(/[./?]*/g, ''); // CodeQL warning
      window.gapi.load('drive-share', () => {
        const shareClient = new window.gapi.drive.share.ShareClient();
        shareClient.setOAuthToken(this.google_access_token);
        shareClient.setItemIds([driveId]);
        shareClient.showSettingsDialog();
      });
    }
  }
};
</script>
