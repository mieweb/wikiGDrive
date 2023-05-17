<template>
  <div>
    <div class="container mt-5">
      <div v-if="loading" class="mt-3">
        <i class="fa-solid fa-rotate fa-spin"></i>
      </div>

      <div class="card" v-else-if="!existInDrives">
        <h2 class="card-header">Access error.</h2>
        <div class="card-body">
          This user doesn't have access to drive.
        </div>
      </div>
      <div class="card" v-else>
        <h2 class="card-header">Folder is not shared with WikiGDrive.</h2>
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
</template>
<script>
import {UtilsMixin} from '../components/UtilsMixin.ts';

export default {
  mixins: [ UtilsMixin ],
  props: {
    shareEmail: {
      type: String
    }
  },
  data() {
    return {
      drives: [],
      loading: true
    };
  },
  computed: {
    existInDrives() {
      return !!this.drives.find(drive => drive.id === this.driveId);
    },
    driveId() {
      const driveIds = this.$route.params.driveId || [];
      return driveIds[0] || undefined;
    }
  },
  async created() {
    this.loading = true;
    try {
      this.drives = await this.DriveClientService.getDrives();
    } finally {
      this.loading = false;
    }
  },
  methods: {
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
