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
      :active="activeTab === 'changes'"
      :to="{ name: 'drive', params: { driveId }, hash: '#changes' }"
      icon="fa-solid fa-code-compare me-1"
      :title="'Changes: ' + changes.length"
    />
    <ToolButton
        v-if="!isGDocsPreview"
        :active="activeTab === 'drive_logs'"
        :to="{ name: 'drive', params: { driveId }, hash: '#drive_logs' }"
        icon="fa-solid fa-computer me-1"
        title="Logs"
    />
    <ToolButton
        v-if="!isGDocsPreview && ZIPKIN_URL"
        :active="activeTab === 'performance'"
        :to="{ name: 'drive', params: { driveId }, hash: '#performance' }"
        icon="fa-solid fa-gauge me-1"
        title="Performance"
    />

    <div class="flex-grow-1"></div>

    <ToolButton
        v-if="!isGDocsPreview"
        :active="activeTab === 'workflows'"
        :to="{ name: 'drive', params: { driveId }, hash: '#workflows' }"
        icon="fa-solid fa-circle-play"
        title="Workflows"
    />
    <ToolButton
        v-if="!isGDocsPreview"
        :active="['drive_config', 'drive_danger', 'import_export'].includes(activeTab)"
        :to="{ name: 'drive', params: { driveId }, hash: '#drive_config' }"
        icon="fa-solid fa-gear me-1"
        title="Settings"
    />
  </ul>
</template>
<script>
import {UtilsMixin} from './UtilsMixin.ts';
import ToolButton from './ToolButton.vue';

const metaEl = document.querySelector('meta[name=ZIPKIN_URL]');
const ZIPKIN_URL = metaEl ? metaEl.getAttribute('content') : undefined;

export default {
  mixins: [UtilsMixin],
  components: {ToolButton},
  props: {
    activeTab: {
      type: String
    }
  },
  data() {
    return { ZIPKIN_URL };
  }
};
</script>
