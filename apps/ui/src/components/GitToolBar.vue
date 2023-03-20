<template>
  <ul class="nav nav-tabs mt-2">
    <ToolButton
        v-if="gitStats.initialized"
        :active="activeTab === 'git_log'"
        @click="setActiveTab('git_log')"
        title="History"
        icon="fa-solid fa-timeline">
      <span class="badge" v-if="gitStats.headAhead > 0">
        {{ gitStats.headAhead }} commits ahead remote
      </span>
      <span class="badge" v-if="gitStats.headAhead < 0">
        {{ -gitStats.headAhead }} commits behind remote
      </span>
    </ToolButton>

    <ToolButton
        v-if="gitStats.initialized"
        :active="activeTab === 'git_commit'"
        @click="setActiveTab('git_commit')"
        title="Commit"
        icon="fa-solid fa-code-commit" >

      <span class="badge" v-if="gitStats.unstaged > 0">
        {{ gitStats.unstaged }} unstaged files
      </span>
    </ToolButton>

    <ToolButton
        v-if="gitStats.initialized"
        :active="activeTab === 'git_info'"
        @click="setActiveTab('git_info')"
        title="Status"
        icon="fa-solid fa-circle-info" >
    </ToolButton>

    <div class="flex-grow-1"></div>

    <ToolButton
        v-if="drive_url"
        :href="drive_url"
        target="_blank"
        title="GoogleDrive"
        icon="fa-brands fa-google-drive"
    />

    <ToolButton
        v-if="github_url"
        :href="github_url"
        target="github"
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
import {UtilsMixin} from './UtilsMixin.ts';
import ToolButton from './ToolButton.vue';

export default {
  mixins: [UtilsMixin],
  components: {ToolButton},
  props: {
    activeTab: {
      type: String
    },
    selectedFile: {
      type: Object
    }
  },
  computed: {
    drive_url() {
      if (!this.selectedFile) {
        return null;
      }
      if (this.selectedFile.id) {
        return 'https://drive.google.com/open?id=' + this.selectedFile.id;
      }
      return null;
    }
  }
};
</script>
