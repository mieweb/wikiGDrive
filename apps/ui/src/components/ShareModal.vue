<template>
  <div class="modal open" tabindex="-1" role="dialog">
    <div class="modal-dialog modal-fullscreen " role="document">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Share drive</h5>
          <button type="button" class="btn-close" @click="close" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <div class="d-flex share-container">
            <div class="flex-column order-0">
              <iframe :src="'/share-drive/' + driveId" class="w-100 h-100"></iframe>
            </div>
            <div class="vr m-2"></div>
            <div class="flex-column order-0 d-flex justify-content-center">
              <div class="m-3">
                <h4 class="d-none d-md-inline mb-5"><i class="fa fa-arrow-left"></i> Follow this steps on the <span class="d-none d-md-inline">left</span><span class="d-md-none">below</span> side:</h4>

                <ol class="mb-5">
                  <li>
                      <label class="form-label flex-grow text-nowrap">Copy our email address:</label>
                      <div class="d-flex align-items-center">
                        <input @click="copy" class="form-control flex-grow-1" readonly :value="share_email" />
                        <button class="btn" @click="copy"><i class="fa fa-copy"></i></button>
                      </div>
                  </li>
                  <li>Click <em>Add people and groups</em>, paste email address</li>
                  <li>Note: WikiGDrive doesn't need Content manager rights.<br/>Change access level to Viewer</li>
                  <li>Click Done</li>
                </ol>

                <h4 class="mt-5">Example:</h4>
                <div class="text-center">
                  <img src="/assets/share-example.png" class="" width="381" />
                </div>

                <h4 class="d-md-none mt-3"><i class="fa fa-arrow-down"></i> Follow this steps on the <span class="d-none d-md-inline">left</span><span class="d-md-none">below</span> side:</h4>
              </div>
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
