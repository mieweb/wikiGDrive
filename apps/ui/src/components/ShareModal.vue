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
              <p>
                You need to authorize WikiGDrive to read files from your drive.
                You can revoke this access any time.
              </p>
              <p>
                You'll be redirected to Google to do that.
              </p>
            </div>
            <div class="modal-footer">
              <button @click="share" class="btn btn-primary">Authorize WikiGDrive</button>
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
  methods: {
    close() {
      this.$root.$removeModal();
    },
    async share() {
      const response = await this.authenticatedClient.fetchApi('/api/gdrive/' + this.driveId + '/share', { method: 'get'});
      const json = await response.json();
      if (json.shareUrl) {
        window.location = json.shareUrl;
      }
    }
  }
};
</script>
