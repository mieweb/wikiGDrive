<template>
  <UserSettings v-if="activeTab === 'drive_config' || activeTab === 'drive_config_git'"
                :activeTab="activeTab"
                :drive_config="drive_config"
                @changed="fetch()"
  />
  <GitSettings v-if="activeTab === 'git_settings'"
               :active-tab="activeTab"
               :drive_config="drive_config"
               :tree-empty="treeEmpty"
               @changed="fetch()"
  />
  <DangerSettings v-if="activeTab === 'drive_danger'"
                  :activeTab="activeTab"
                  :drive_config="drive_config"
  />
</template>
<script>
import UserSettings from './UserSettings.vue';
import DangerSettings from './DangerSettings.vue';
import GitSettings from './GitSettings.vue';
import {UtilsMixin} from './UtilsMixin.ts';

export default {
  name: 'SettingsTab',
  mixins: [UtilsMixin],
  components: {GitSettings, DangerSettings, UserSettings},
  props: {
    activeTab: {},
    treeEmpty: {}
  },
  data() {
    return {
      drive_config: null
    };
  },
  created() {
    this.fetch();
  },
  watch: {
    driveId() {
      this.fetch();
    }
  },
  methods: {
    async processResponse(json) {
      this.drive_config = json;
    },
    async fetch() {
      const response = await this.authenticatedClient.fetchApi(`/api/config/${this.driveId}`);
      const json = await response.json();
      await this.processResponse(json);
    }
  }
};
</script>
