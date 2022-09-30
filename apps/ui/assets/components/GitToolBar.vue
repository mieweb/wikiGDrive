<template>
  <ul class="nav nav-tabs mt-2">
    <ToolButton
        v-if="gitInitialized"
        :active="activeTab === 'git_log'"
        @click="setActiveTab('git_log')"
        title="History"
        icon="fa-solid fa-timeline"
    />

    <ToolButton
        v-if="gitInitialized"
        :active="activeTab === 'git_commit'"
        @click="setActiveTab('git_commit')"
        title="Commit"
        icon="fa-solid fa-code-commit"
    />

    <div class="flex-grow-1"></div>

    <ToolButton
        v-if="github_url"
        :active="activeTab === 'git_hub'"
        @click="openWindow(github_url)"
        title="GitHub"
        icon="fa-brands fa-github"
    />

    <ToolButton
        v-if="!isGDocsPreview"
        :active="activeTab === 'git_settings'"
        :to="{ name: 'drive', params: { driveId }, hash: '#git_settings' }"
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
