<template>
  <GitCommit v-if="activeTab === 'git_commit'" :folderPath="folderPath" :contentDir="contentDir" :selectedFile="selectedFile" :active-tab="activeTab" :sidebar="sidebar" :shareEmail="shareEmail" />

  <BaseLayout v-else :share-email="shareEmail" :sidebar="sidebar">
    <template v-slot:navbar="{ collapsed, collapse }">
      <NavBar :sidebar="sidebar" :collapsed="collapsed" @collapse="collapse" v-if="!notRegistered">
        <NavSearch />
        <NavTabs :folder-path="folderPath" :activeTab="activeTab" :selectedFile="selectedFile" :selectedFolder="selectedFolder" @sync="syncSingle" />
      </NavBar>
    </template>

    <template v-slot:sidebar="{ collapse }">
      <FilesTree :folder-path="folderPath" :not-registered="notRegistered" v-if="sidebar" @collapse="collapse" @sync="syncSingle" ref="filesTree" />
    </template>

    <template v-slot:default>
      <NotRegistered v-if="notRegistered" :share-email="shareEmail" />
      <div v-if="notFound" class="container">
        <div class="alert alert-warning text-wrap">
          404 NOT FOUND: {{ notFound }}
        </div>
      </div>

      <ChangesViewer v-if="activeTab === 'sync'" :selected-file="selectedFile" :activeTab="activeTab" @sync="syncSingle" @transform="transformSingle" @showLogs="showLogs" />
      <GitLog v-if="activeTab === 'git_log'" :folderPath="folderPath" :selectedFile="selectedFile" :active-tab="activeTab" />
      <GitSettings v-if="activeTab === 'git_settings'" :active-tab="activeTab" />

      <DriveTools v-if="activeTab === 'drive_tools'" :folderPath="folderPath" :selectedFile="selectedFile" :selected-folder="selectedFolder" :active-tab="activeTab" />
      <LogsViewer v-if="activeTab === 'drive_logs'" :contentDir="contentDir" :active-tab="activeTab" v-model="logsState" />
      <ZipkinViewer v-if="activeTab === 'performance'" :active-tab="activeTab" />
      <DangerSettings v-if="activeTab === 'drive_danger'" :activeTab="activeTab" />
      <UserSettings v-if="activeTab === 'drive_config' || activeTab === 'drive_config_git'" :activeTab="activeTab" />
      <ActionsEditor v-if="activeTab === 'actions'" :active-tab="activeTab" />

      <div v-if="(activeTab === 'html' || activeTab === 'markdown' || activeTab === 'drive_backlinks') && selectedFile.mimeType === 'text/x-markdown'">
        <FilePreview :contentDir="contentDir" :folder-path="folderPath" :activeTab="activeTab" :selectedFile="selectedFile" />
      </div>
      <div v-if="(activeTab === 'html' || activeTab === 'markdown' || activeTab === 'drive_backlinks') && selectedFile.mimeType === 'image/svg+xml'">
        <ImagePreview :folder-path="folderPath" :activeTab="activeTab" :selectedFile="selectedFile" />
      </div>
      <div v-if="(activeTab === 'html') && selectedFile.mimeType === 'application/binary'">
        <IframePreview :folder-path="folderPath" :activeTab="activeTab" :selectedFile="selectedFile" />
      </div>

      <DriveTools v-if="(!activeTab || activeTab === 'html') && !selectedFile.id && !notFound"
                  :folderPath="folderPath"
                  :selectedFile="selectedFile"
                  :selected-folder="selectedFolder"
                  :active-tab="activeTab"
                  :tree-empty="treeEmpty"
                  :tree-version="treeVersion"
      />

    </template>
  </BaseLayout>
</template>
<script lang="ts">
import BaseLayout from '../layout/BaseLayout.vue';
import {DEFAULT_TAB, UiMixin} from '../components/UiMixin.ts';
import {UtilsMixin} from '../components/UtilsMixin.ts';
import FilesTree from '../components/FilesTree.vue';
import NotRegistered from './NotRegistered.vue';
import FilePreview from '../components/FilePreview.vue';
import ImagePreview from '../components/ImagePreview.vue';
import IframePreview from '../components/IframePreview.vue';
import NavTabs from '../components/NavTabs.vue';
import NavSearch from '../components/NavSearch.vue';
import LogsViewer from '../components/LogsViewer.vue';
import ZipkinViewer from '../components/ZipkinViewer.vue';
import ChangesViewer from '../components/ChangesViewer.vue';
import UserSettings from '../components/UserSettings.vue';
import DangerSettings from '../components/DangerSettings.vue';
import GitLog from '../components/GitLog.vue';
import GitCommit from '../components/GitCommit.vue';
import DriveTools from '../components/DriveTools.vue';
import NavBar from '../components/NavBar.vue';
import GitSettings from '../components/GitSettings.vue';
import ActionsEditor from '../components/ActionsEditor.vue';

export default {
  name: 'FolderView',
  components: {
    GitSettings,
    NavBar,
    DriveTools,
    NavTabs,
    NavSearch,
    NotRegistered,
    FilesTree,
    BaseLayout,
    FilePreview,
    ImagePreview,
    IframePreview,
    LogsViewer,
    ZipkinViewer,
    ChangesViewer,
    UserSettings,
    DangerSettings,
    ActionsEditor,
    GitLog,
    GitCommit
  },
  mixins: [ UtilsMixin, UiMixin ],
  data() {
    return {
      rootFolder: {},
      folderPath: '',
      contentDir: '',
      activeTab: DEFAULT_TAB,
      files: [],
      selectedFile: {},
      selectedFolder: {},
      treeEmpty: false,
      treeVersion: null,
      notFound: false,
      logsState: {
        from: undefined,
        until: undefined
      }
    };
  },
  computed: {
    sidebar() {
      if (this.notRegistered) {
        return false;
      }
      return this.activeTab !== 'drive_logs' && this.activeTab !== 'performance' && this.activeTab !== 'drive_config' && this.activeTab !== 'drive_danger' && this.activeTab !== 'git_settings' && this.activeTab !== 'sync' && this.activeTab !== 'actions';
    },
    jobs() {
      return this.$root.jobs || [];
    },
    active_job() {
      const job = this.jobs.find(job => job.state === 'running');
      if (job) {
        return job.title;
      }
      return '';
    },
  },
  created() {
    this.fetch();
    this.rootFolder = this.$root.drive;
    this.emitter.on('tree:changed', () => {
      this.fetch();
    });
  },
  watch: {
    async $route() {
      await this.fetch();
      this.activeTab = this.$route.hash.replace(/^#/, '') || DEFAULT_TAB;
    }
  },
  mounted() {
    this.activeTab = this.$route.hash.replace(/^#/, '') || DEFAULT_TAB;
  },
  methods: {
    async fetchFolder(driveId, filePath) {
      const pathContent = await this.FileClientService.getFile('/' + driveId + filePath);
      this.contentDir = pathContent.contentDir;
      this.folderPath = filePath;
      this.files = pathContent.files || [];
      this.treeEmpty = pathContent.treeEmpty;
      this.treeVersion = pathContent.treeVersion;
      return pathContent;
    },
    async fetch() {
      if (this.drive.notRegistered) {
        this.shareEmail = this.drive.share_email;
        this.notRegistered = true;
        return;
      }

      const filePath = this.$route.path.substring('/drive'.length);

      const parts = filePath.split('/').filter(s => s.length > 0);
      const driveId = parts.shift();
      const baseName = parts.pop() || '';

      this.selectedFile = {};

      try {
        if (baseName.indexOf('.') > -1) {
          const dirPath = '/' + parts.join('/');
          await this.fetchFolder(driveId, dirPath);
          const file = this.files.find(file => (file.realFileName || file.fileName) === baseName) || {};
          this.selectedFolder = null;
          this.selectedFile = file || {};
        } else {
          parts.push(baseName);
          const dirPath = '/' + parts.join('/');
          this.selectedFolder = await this.fetchFolder(driveId, dirPath);
          this.selectedFile = {};
        }
        this.notFound = false;
      } catch (err) {
        if (err.code === 404) {
          this.shareEmail = err.share_email || this.drive.share_email;
          this.notFound = filePath;
        }
      }
    },
    showLogs(param) {
      this.logsState = {
        from: param?.from || this.logsState.from,
        until: param?.to || this.logsState.until
      };
       // =  || undefined;
      // this.logsState.until = param?.until || undefined;
      console.log('showLogs', {
        from: param.from,
        froms: new Date(param.from).toISOString(),
        untils: new Date(param.until).toISOString(),
      }, JSON.stringify(this.logsState));
    }
  }
};
</script>
