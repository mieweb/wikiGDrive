<template>
  <div class="container mainbar__content-height" v-if="config">
    <StatusToolBar :active-tab="activeTab" />

    <div class="overflow-scroll d-flex flex-row mt-3">
      <SettingsSidebar />

      <div class="card flex-column order-0 flex-grow-1 flex-shrink-1 overflow-scroll border-left-0">
        <div class="card-body">

          <h4>Transformed files</h4>

          <button class="btn btn-danger" type="button" @click="nukeContentDir()"><i class="fa-solid fa-explosion"></i> Nuke markdown directory (with .git subdir)</button>

          <h4>Git</h4>

          <button class="btn btn-warning" type="button" @click="resetToLocal">Reset to local</button>
          <button v-if="remote_url" class="btn btn-warning" type="button" @click="resetToRemote">Reset to remote</button>
          <button class="btn btn-warning" type="button" @click="removeUntracked">Remove untracked files</button>
          <button class="btn btn-danger" type="button" @click="nukeGitDir()"><i class="fa-solid fa-explosion"></i> Nuke .git directory</button>

          <h4>Start over</h4>

          <button class="btn btn-danger" type="button" @click="nukeAll()"><i class="fa-solid fa-bomb"></i> Remove all files</button>

        </div>
      </div>
    </div>
  </div>
</template>
<script>
import {UtilsMixin} from './UtilsMixin.ts';
import {DangerMixin} from './DangerMixin.ts';
import StatusToolBar from './StatusToolBar.vue';
import SettingsSidebar from './SettingsSidebar.vue';

export default {
  mixins: [UtilsMixin, DangerMixin],
  components: {
    SettingsSidebar,
    StatusToolBar
  },
  props: {
    activeTab: {
      type: String
    },
    drive_config: {}
  },
  computed: {
    config() {
      return this.drive_config?.config || {};
    },
    remote_url() {
      return this.drive_config?.remote_url || '';
    }
  }
};
</script>
