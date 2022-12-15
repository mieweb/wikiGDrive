<template>
  <div class="modal open" tabindex="-1" role="dialog">
    <div class="modal-dialog modal-fullscreen " role="document">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Share drive</h5>
          <button type="button" class="btn-close" @click="close" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <div class="d-flex h-100">
            <div class="flex-column w-50">
              <div class="m-3">
                <h4>Example:</h4>
                <img src="/assets/share-example.png" class="w-100" />
              </div>
            </div>
            <div class="flex-column w-50">
              <div class="d-flex align-items-center">
                <label class="form-label flex-grow text-nowrap">Share your drive with:</label>
                <input @click="copy" class="form-control flex-grow-1" readonly :value="share_email" />
                <button class="btn" @click="copy"><i class="fa fa-copy"></i></button>
              </div>
              <iframe :src="'/share-drive/' + driveId" class="w-100 h-100"></iframe>
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
      authPopup: null,
      share_email: null
    };
  },
  async mounted() {
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
    }
  }
};
</script>
