<template>
  <div>
    <ul class="mui-tabs__bar">
      <li :class="{ 'mui--is-active': activeTab === 'markdown' }" class="mui-tab__dropdown">
        <a @click.prevent.stop="setActiveTab('markdown')" data-mui-toggle="tab">Preview</a>
        <ul class="mui-dropdown__menu">
          <li><a @click.prevent.stop="setActiveTab('user_config')">Settings</a></li>
          <li v-if="preview.fileId"><a @click.prevent.stop="downloadOdt(preview.fileId)">Download odt</a></li>
        </ul>
      </li>
      <li :class="{ 'mui--is-active': activeTab === 'drive' }" class="mui-tab__dropdown">
        <a>Drive</a>
        <ul class="mui-dropdown__menu">
          <li v-if="isSinglePreview"><a @click.prevent.stop="gotoFolder(preview.folderId)">WikiGDrive Folder</a></li>
          <li v-if="preview.folderId"><a @click.prevent.stop="goToGDrive(preview.folderId)">Google Drive</a></li>
          <li v-if="preview.fileId"><a @click.prevent.stop="goToGDocs(preview.fileId)">Google Docs</a></li>
          <li><a @click.prevent.stop="setActiveTab('drive_backlinks')">BackLinks</a></li>
          <li v-if="preview.tocFileId"><a @click.prevent.stop="goToToc(preview.tocFileId)">TOC</a></li>
          <li v-if="preview.navFileId"><a @click.prevent.stop="goToToc(preview.navFileId)">Navigation</a></li>
        </ul>
      </li>
      <li :class="{ 'mui--is-active': activeTab.startsWith('git_') }" class="mui-tab__dropdown">
        <a @click.prevent.stop="setActiveTab('git_log')" data-mui-toggle="tab">Git</a>
        <ul class="mui-dropdown__menu">
          <li v-if="github_url"><a @click.prevent.stop="openWindow(github_url)">GitHub</a></li>
          <li v-if="git.initialized"><a @click.prevent.stop="setActiveTab('git_commit')">Commit</a></li>
          <li v-if="git.initialized"><a @click.prevent.stop="setActiveTab('git_log')">History</a></li>
        </ul>
      </li>
      <li :class="{ 'mui--is-active': activeTab === 'sync' }" class="mui-tab__dropdown">
        <a v-if="preview.syncing">
          <i class="fa-solid fa-rotate fa-spin"></i>
          Syncing
        </a>
        <a v-else>
          Last synced: @TODO
        </a>
        <ul class="mui-dropdown__menu">
          <li><a @click.prevent="$emit('sync')">Sync single</a></li>
        </ul>
      </li>
    </ul>

    <div v-if="activeTab === 'markdown' && preview.mimeType === 'text/x-markdown'">
      <MarkDown>{{preview.content}}</MarkDown>
    </div>

    <BackLinks v-if="activeTab === 'drive_backlinks'" :backlinks="preview.backlinks" />
    <GitLog v-if="activeTab === 'git_log'" :git="git" @commit="$emit('commit', $event)" @push="$emit('push', $event)" />
    <UserConfig v-if="activeTab === 'user_config'" :git="git" />
    <GitCommit v-if="activeTab === 'git_commit'" :git="git" @commit="$emit('commit', $event)" @push="$emit('push', $event)" />
  </div>
</template>
<script>
import {UtilsMixin} from './UtilsMixin.mjs';
import {UiMixin} from './UiMixin.mjs';
import MarkDown from './MarkDown.vue';
import GitCommit from './GitCommit.vue';
import UserConfig from './UserConfig.vue';
import GitLog from './GitLog.vue';
import BackLinks from './BackLinks.vue';

export default {
  name: 'FilePreview',
  mixins: [UtilsMixin, UiMixin],
  components: {
    GitLog,
    GitCommit,
    UserConfig,
    MarkDown,
    BackLinks
  },
  props: {
    activeTab: {
      type: String
    },
    hasSync: {
      type: Boolean,
      default: false
    },
    preview: Object,
    git: Object
  },
  computed: {
    isSinglePreview() {
      return this.$route.name === 'file';
    }
  },
  methods: {
    setActiveTab(tab) {
      this.$router.replace({ hash: '#' + tab });
    },
    gotoFolder(folderId) {
      const routeUrl = this.$router.resolve({ name: 'folder', params: { driveId: this.driveId, folderId: folderId || this.driveId, fileId: this.$route.params.fileId } });
      window.open(routeUrl.href, '_blank');
    },
    downloadOdt(fileId) {
      const odtPath = `/api/drive/${this.driveId}/file/${fileId}.odt`;
      window.open(odtPath, '_blank');
    },
    goToToc(fileId) {
      this.$router.push({ name: 'folder', params: { driveId: this.driveId, folderId: this.driveId, fileId: fileId } });
    }
  }
};
</script>
