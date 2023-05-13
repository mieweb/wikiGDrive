<template>
  <div class="modal open" tabindex="-1" role="dialog">
    <div class="modal-dialog open " role="document">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Share drive</h5>
          <button type="button" class="btn-close" @click="close" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <div class="justify-content-center">
            <div class="m-3">
              <h5>
                Follow those steps:
              </h5>
              <ol class="mb-5s">
                <li>
                    <label class="form-label flex-grow text-nowrap">Copy our email address:</label>
                    <div class="d-flex align-items-center">
                      <input @click="copy" class="form-control flex-grow-1" readonly :value="share_email" />
                      <button class="btn" @click="copy"><i class="fa fa-copy"></i></button>
                    </div>
                </li>
              </ol>
              <h5>On the next screen:</h5>
              <ol class="mb-5s">
                <li>
                  <em>Add people and groups</em>, paste above email address
                </li>
                <li>Note: WikiGDrive doesn't need Content manager rights.<br/>Change access level to Viewer</li>
                <li>Click Share</li>
              </ol>

              <h4 class="mt-5">Example:</h4>
              <div class="text-center" v-if="google_access_token">
                <img src="/assets/share-example.png" class="" width="381" />
              </div>

              <h4 class="d-md-none mt-3"><i class="fa fa-arrow-down"></i> Follow this steps on the <span class="d-none d-md-inline">left</span><span class="d-md-none">below</span> side:</h4>
            </div>
            <div class="modal-footer">
              <button v-if="gapi" @click="share" class="btn btn-primary">Go to share screen</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<script>
export default {
  name: 'ShareModal',
  props: ['driveId'],
  data() {
    return {
      gapi: null,
      authPopup: null,
      share_email: null,
      google_access_token: null
    };
  },
  async mounted() {
    if (!window.gapi) {
      const scriptElem = document.createElement('script');
      scriptElem.id = 'gapiScript';
      scriptElem.defer = true;
      scriptElem.src = 'https://apis.google.com/js/api.js';
      scriptElem.onload = () => {
        this.gapi = window.gapi;
      };
      document.body.appendChild(scriptElem);
    } else {
      this.gapi = window.gapi;
    }
    const response = await this.authenticatedClient.fetchApi('/api/share-token', { method: 'post'});
    const json = await response.json();
    this.google_access_token = json.google_access_token;
    this.share_email = json.share_email;
  },
  methods: {
    close() {
      this.$root.$removeModal();
    },
    async copy() {
      await navigator.clipboard.writeText(this.share_email);
    },
    async share() {
      if (!this.google_access_token || !this.gapi) {
        return;
      }
      const driveId = this.driveId;
      this.gapi.load('drive-share', () => {
        const shareClient = new window.gapi.drive.share.ShareClient();
        shareClient.setOAuthToken(this.google_access_token);
        shareClient.setItemIds([driveId]);
        shareClient.showSettingsDialog();
      });
    }
  }
};
</script>
<style>
@media (max-width: 767px) {
  .share-container {
    flex-direction: column;
  }
  .vr {
    width: auto;
    min-height: 1px;
    border-bottom: 1px solid #dee2e6;
    order: 1;
  }
  .flex-column:first-child {
    order: 2;
    min-height: 400px;
  }
}
@media (min-width: 768px) {
  .share-container {
    height: 100% !important;
  }
  .flex-column {
    width: 50%;
  }
  .vr {
    border-left: 1px solid #dee2e6;
  }

}
</style>
