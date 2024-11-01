<template>
  <GitCommit v-if="activeTab === 'git_commit'" :folderPath="folderPath" :contentDir="contentDir" :selectedFile="selectedFile" :selectedFolder="selectedFolder" :active-tab="activeTab" :sidebar="sidebar" :shareEmail="shareEmail" />
  <GitInfo v-else-if="activeTab === 'git_info'" :folderPath="folderPath" :contentDir="contentDir" :selectedFile="selectedFile" :active-tab="activeTab" :sidebar="sidebar" :shareEmail="shareEmail" />
  <BaseLayout v-else :share-email="shareEmail" :sidebar="sidebar">
    <template v-slot:navbar="{ collapsed, collapse }">
      <NavBar :sidebar="sidebar" :collapsed="collapsed" @collapse="collapse" v-if="!notRegistered">
        <NavSearch />
        <NavTabs :folder-path="folderPath" :activeTab="activeTab" :selectedFile="selectedFile" :selectedFolder="selectedFolder" @sync="syncSingle($event.$event, $event.file)" />
      </NavBar>
    </template>

    <template v-slot:sidebar="{ collapse }">
      <FilesTree :folder-path="folderPath" :not-registered="notRegistered" v-if="sidebar" @collapse="collapse" @sync="syncSingle($event.$event, $event.file)" ref="filesTree" />
    </template>

    <template v-slot:default>
      <NotRegistered v-if="notRegistered" :share-email="shareEmail" />
      <div v-else>

        <div v-if="notFound" class="container">
          <div class="alert alert-warning text-wrap">
            404 NOT FOUND: {{ notFound }}
          </div>
        </div>

        <JobsViewer v-if="activeTab === 'sync'" :selected-file="selectedFile" :activeTab="activeTab" @sync="syncSingle($event.$event, $event.file)" @showLogs="showLogs" />
        <ChangesViewer v-if="activeTab === 'changes'" :selected-file="selectedFile" :activeTab="activeTab" @sync="syncSingle($event.$event, $event.file)" @showLogs="showLogs" />
        <GitLog v-if="activeTab === 'git_log'" :folderPath="folderPath" :selectedFile="selectedFile" :active-tab="activeTab" />

        <DriveTools v-if="activeTab === 'drive_tools'" :folderPath="folderPath" :selectedFile="selectedFile" :selected-folder="selectedFolder" :active-tab="activeTab" />

        <div v-if="activeTab === 'drive_logs'">
          <JobLogsViewer v-if="activeTabParams[0]" contentDir="contentDir" :active-tab="activeTab" :jobId="activeTabParams[0]" />
          <LogsViewer v-else :contentDir="contentDir" :active-tab="activeTab" v-model="logsState" />
        </div>

        <SettingsTab v-if="['git_settings', 'drive_config', 'drive_config_git', 'drive_danger', 'import_export'].includes(activeTab)"
                     :active-tab="activeTab"
                     :tree-empty="treeEmpty"
        />
        <ZipkinViewer v-if="activeTab === 'performance'" :active-tab="activeTab" />
        <WorkflowsEditor v-if="activeTab === 'workflows'" :active-tab="activeTab" />

        <div v-if="(activeTab === 'html' || activeTab === 'markdown' || activeTab === 'drive_backlinks') && selectedFile.mimeType === 'text/x-markdown'">
          <FilePreview :folder-path="folderPath" :activeTab="activeTab" :selectedFile="selectedFile" :content-dir="contentDir" />
        </div>
        <div v-else-if="(activeTab === 'html' || activeTab === 'markdown' || activeTab === 'drive_backlinks') && selectedFile.mimeType === 'image/svg+xml'">
          <ImagePreview :folder-path="folderPath" :activeTab="activeTab" :selectedFile="selectedFile" :content-dir="contentDir" />
        </div>
        <div v-else-if="(activeTab === 'html') && ['application/binary', 'application/pdf'].includes(selectedFile.mimeType)">
          <IframePreview :folder-path="folderPath" :activeTab="activeTab" :selectedFile="selectedFile" />
        </div>
        <div v-else-if="(activeTab === 'html' || activeTab === 'markdown' || activeTab === 'drive_backlinks') && selectedFile.mimeType && selectedFile.mimeType.startsWith('text/')">
          <FileEditor :folder-path="folderPath" :activeTab="activeTab" :selectedFile="selectedFile" />
        </div>
        <div>
          <div v-if="(!activeTab || activeTab === 'html') && !selectedFile.id && !notFound">
            <DriveTools
                 :folderPath="folderPath"
                 :selectedFile="selectedFile"
                 :selected-folder="selectedFolder"
                 :active-tab="activeTab"
                 :tree-empty="treeEmpty"
                 :drive-empty="driveEmpty"
                 :tree-version="treeVersion"
            />

            <GitSettings :active-tab="activeTab" v-if="!github_url" :tree-empty="treeEmpty">
              <template v-slot:header>
                <div class="card-header alert-danger">
                  Git is not configured
                </div>
              </template>
              <template v-slot:toolbar>
                <span></span>
              </template>
              <template v-slot:sidebar>
                <span></span>
              </template>
            </GitSettings>

            <UserSettings v-if="!(activeTab === 'drive_config' || activeTab === 'drive_config_git')" :activeTab="activeTab">
              <template v-slot:header>
                <div class="card-header alert-danger" v-if="!contentDir">
                  Content subdirectory must be set and start with /
                </div>
              </template>
              <template v-slot:toolbar>
                <span></span>
              </template>
              <template v-slot:sidebar>
                <span></span>
              </template>
            </UserSettings>

          </div>
<!--          <IframePreview v-else-if="(activeTab === 'html' || activeTab === 'markdown') && !selectedFolder.path" :folder-path="folderPath" :activeTab="activeTab" :selectedFile="selectedFile" />-->
        </div>
      </div>
    </template>
  </BaseLayout>
</template>
<script lang="ts">
import BaseLayout from '../layout/BaseLayout.vue';
import {UiMixin} from '../components/UiMixin.ts';
import {DEFAULT_TAB, UtilsMixin} from '../components/UtilsMixin.ts';
import FilesTree from '../components/FilesTree.vue';
import NotRegistered from './NotRegistered.vue';
import FilePreview from '../components/FilePreview.vue';
import ImagePreview from '../components/ImagePreview.vue';
import IframePreview from '../components/IframePreview.vue';
import FileEditor from '../components/FileEditor.vue';
import NavTabs from '../components/NavTabs.vue';
import NavSearch from '../components/NavSearch.vue';
import LogsViewer from '../components/LogsViewer.vue';
import JobLogsViewer from '../components/JobLogsViewer.vue';
import ZipkinViewer from '../components/ZipkinViewer.vue';
import ChangesViewer from '../components/ChangesViewer.vue';
import JobsViewer from '../components/JobsViewer.vue';
import UserSettings from '../components/UserSettings.vue';
import GitLog from '../components/GitLog.vue';
import GitCommit from '../components/GitCommit.vue';
import GitInfo from '../components/GitInfo.vue';
import DriveTools from '../components/DriveTools.vue';
import NavBar from '../components/NavBar.vue';
import GitSettings from '../components/GitSettings.vue';
import WorkflowsEditor from '../components/WorkflowsEditor.vue';
import SettingsTab from '../components/SettingsTab.vue';

export default {
  name: 'FolderView',
  components: {
    SettingsTab,
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
    FileEditor,
    LogsViewer,
    JobLogsViewer,
    ZipkinViewer,
    ChangesViewer,
    JobsViewer,
    UserSettings,
    WorkflowsEditor,
    GitLog,
    GitCommit,
    GitInfo
  },
  mixins: [ UtilsMixin, UiMixin ],
  data() {
    return {
      rootFolder: {},
      folderPath: '',
      contentDir: '',
      activeTab: DEFAULT_TAB,
      activeTabParams: [],
      files: [],
      selectedFile: {
        id: null,
        mimeType: ''
      },
      selectedFolder: {},
      driveEmpty: false,
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
      return this.activeTab !== 'drive_logs' && this.activeTab !== 'performance' && this.activeTab !== 'drive_config' &&
        this.activeTab !== 'drive_danger' && this.activeTab !== 'git_settings' && this.activeTab !== 'sync' &&
        this.activeTab !== 'changes' && this.activeTab !== 'workflows' && this.activeTab !== 'import_export';
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
      this.$nextTick(() => {
        this.fetch();
      });
    });
  },
  watch: {
    async $route() {
      await this.fetch();
      [this.activeTab, ...this.activeTabParams] = this.getActiveTab();
    }
  },
  mounted() {
    [this.activeTab, ...this.activeTabParams] = this.getActiveTab();
  },
  methods: {
    async fetchFolder(driveId, filePath) {
      const pathContent = await this.FileClientService.getFile('/' + driveId + filePath);
      this.contentDir = pathContent.contentDir;
      this.folderPath = filePath;
      this.files = pathContent.files || [];
      this.driveEmpty = pathContent.driveEmpty;
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
          const file = this.files.find(file => (file.realFileName || file.fileName) === baseName) || {
            path: filePath.replace('/' + driveId + this.contentDir, '')
          };
          this.selectedFolder = {};
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
