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
        <div class="card-body">
          <button class="btn btn-primary" type="button" @click.stop="share(driveId)"><i class="fa fa-share"></i> Share folder</button>
        </div>
      </div>

      <br/>
      <div class="card">
        <div class="card-body">
          Go back to <a href="/">homepage</a>
        </div>
      </div>
    </div>
  </div>
</template>
<script>
import {UtilsMixin} from '../components/UtilsMixin.ts';
import {markRaw} from 'vue';
import ShareModal from '../components/ShareModal.vue';

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
