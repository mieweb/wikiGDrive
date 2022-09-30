<template>
  <ul class="nav nav-tabs mt-2">
    <ToolButton
        v-if="!isGDocsPreview"
        :active="activeTab === 'sync'"
        :to="{ name: 'drive', params: { driveId }, hash: '#sync' }"
        icon="fa-solid fa-computer me-1"
        title="Sync"
    />
    <ToolButton
        v-if="!isGDocsPreview"
        :active="activeTab === 'drive_logs'"
        :to="{ name: 'drive', params: { driveId }, hash: '#drive_logs' }"
        icon="fa-solid fa-computer me-1"
        title="Logs"
    />

    <div class="flex-grow-1"></div>

    <ToolButton
        v-if="!isGDocsPreview"
        :active="activeTab === 'drive_config'"
        :to="{ name: 'drive', params: { driveId }, hash: '#drive_config' }"
        icon="fa-solid fa-gear me-1"
        title="Settings"
    />
  </ul>
</template>
<script>
import {UtilsMixin} from './UtilsMixin.mjs';
import ToolButton from './ToolButton.vue';

export default {
  mixins: [UtilsMixin],
  components: {ToolButton},
  props: {
    activeTab: {
      type: String
    }
  }
};
</script>
