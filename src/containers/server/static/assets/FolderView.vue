<template>
  <BaseLayout :sidebar="!notRegistered">
    <template v-slot:navbar>
      <div class="mui-container-fluid">
        <table style="width: 100%;">
          <tr class="mui--appbar-height">
            <td class="mui--text-title" v-if="rootFolder.name">
              {{ rootFolder.name }}
            </td>
            <td class="mui--text-title" v-else>
              WikiGDrive
            </td>
            <td v-if="rootFolder.name">
              <button type="button" @click="syncAll" class="mui-btn mui-btn--small mui--pull-right"><i class="fa-solid fa-rotate" :class="{'fa-spin': rootFolder.syncing}"></i> Sync All</button>
            </td>
          </tr>
        </table>
      </div>
    </template>

    <template v-slot:sidebar>
      <table class="mui-table mui-table--bordered mui-table--hover mui-table--clickable" v-if="!notRegistered && files.length > 0">
        <thead>
        <tr>
          <th></th>
          <th>File</th>
          <th>Ver</th>
          <th>Modified</th>
        </tr>
        </thead>
        <tbody>
        <tr v-if="parentId" @click="selectFile({ id: parentId, mimeType: 'application/vnd.google-apps.folder' })">
          <td><i class="fa-solid fa-folder"></i></td>
          <td>
            ..
          </td>
          <td></td>
          <td></td>
        </tr>
        <tr v-for="file in files" @click="selectFile(file.google)">
          <td>
            <i class="fa-solid fa-folder" v-if="isFolder(file.google)"></i>
            <i class="fa-solid fa-file-image" v-else-if="isImage(file.google)"></i>
            <i class="fa-solid fa-file-lines" v-else-if="isDocument(file.google)"></i>
            <i v-else class="fa-solid fa-file"></i>
          </td>
          <td>
            {{ file.google.name }}<br/>
            {{ file.local ? file.local.fileName : '' }}
          </td>
          <td @click.stop="sync(file)">
            #{{ file.local ? file.local.version : '' }}
            <i class="fa-solid fa-rotate" :class="{'fa-spin': file.syncing}"></i>
          </td>
          <td>{{ file.google.modifiedTime }}</td>
          <td @click.stop="goToGDrive(file.google)"><i class="fa-brands fa-google-drive"></i></td>
        </tr>
        </tbody>
      </table>
    </template>
    <template v-slot:default>
      <div v-if="activeTab === 'status'">
        <table class="mui-table mui-table--bordered" v-if="file">
          <tbody v-if="file.google">
          <tr>
            <th>FileId</th>
            <td>{{file.google.id}}</td>
          </tr>
          <tr>
            <th>Name</th>
            <td>{{file.google.name}}</td>
          </tr>
          <tr>
            <th>Modification</th>
            <td>
              {{file.google.modifiedTime}}
              <span v-if="file.google.lastModifyingUser">
                {{file.google.lastModifyingUser.displayName}}
              </span>
            </td>
          </tr>
          <tr>
            <th>Version</th>
            <td>
              {{file.google.version}}
              <button type="button" class="mui-btn mui-btn--danger" @click="markDirty">Sync</button>
            </td>
          </tr>
          </tbody>

          <tbody v-if="file.local && file.google">
          <tr>
            <th>
              Content downloaded
            </th>
            <td>
              {{file.local.modifiedTime}}
            </td>
          </tr>
          <tr>
            <th>
              Content version
            </th>
            <td>
              {{file.local.version}} <span v-if="file.local.version < file.google.version">Outdated</span>
            </td>
          </tr>
          <tr>
            <th>
              Local Path
            </th>
            <td>
              {{file.local.localPath}}
            </td>
          </tr>
          </tbody>
          <tbody v-else>
          <tr>
            <th>
              Content awaiting download
            </th>
          </tr>
          </tbody>
        </table>
      </div>

      <div v-if="activeTab === 'git'">
        <div v-if="!file.git">Repo not initialized</div>
        <div v-else>
          <table class="mui-table mui-table--bordered" v-if="file">
            <tbody v-if="file.google">
            <tr>
              <th>Status</th>
              <td>{{file.git.status}}</td>
            </tr>
            </tbody>
          </table>
          <form>
            <div class="mui-textfield">
              <textarea placeholder="Commit message"></textarea>
            </div>
            @TODO
            <button type="button" class="mui-btn mui-btn--danger" @click="markDirty">Commit</button>
          </form>
        </div>
      </div>

      <div v-if="notRegistered">
        <div class="mui-container">
          <br/><br/><br/><br/>
          <div class="mui-panel">
            <h2>Folder is not shared with WikiGDrive.</h2>
            <ol>
              <li>Go to <a :href="'https://drive.google.com/open?id=' + driveId" :target="driveId">folder</a></li>
              <li>Make if publicly readable <span v-if="shareEmail"><br/>or share with <input size="50" readonly :value="shareEmail" @click="copyEmail" /></span></li>
            </ol>
            <button class="mui-btn mui-btn--primary" type="button" @click="refresh">Retry</button>
          </div>
        </div>
      </div>

      <div v-if="preview.mimeType === 'text/x-markdown'">
        <form>
          <div class="mui-textfield">
            <MarkDown>{{preview.content}}</MarkDown>
          </div>
        </form>
      </div>

      <div v-if="activeTab === 'debug'">
        <pre>{{ file }}</pre>
      </div>
    </template>
  </BaseLayout>
</template>
<script lang="ts">
import BaseLayout from './BaseLayout.vue';
import MarkDown from './MarkDown.vue';

export default {
  name: 'FolderView',
  components: {
    MarkDown,
    BaseLayout
  },
  data() {
    return {
      activeTab: 'status',
      files: [],
      parentId: '',
      preview: {},
      rootFolder: {},
      notRegistered: false,
      shareEmail: ''
    };
  },
  computed: {
    driveId() {
      return this.$route.params.driveId;
    },
    // folderPath
  },
  created() {
    this.fetch();
    setInterval(() => {
      this.runInspect();
    }, 2000);
  },
  watch: {
    $route() {
      this.fetch();
    }
  },
  methods: {
    async fetch() {
      this.files = [];
      this.parentId = '';
      this.preview = {};

      const folderId = this.$route.params.folderId;
      const fileId = this.$route.params.fileId;
      const response = await fetch(`/api/drive/${this.driveId}` + (folderId && folderId !== this.driveId ? '/folder/' + folderId : ''));
      const json = await response.json();

      this.notRegistered = !!json.not_registered;
      if (this.notRegistered) {
        this.shareEmail = json.share_email;
        return;
      }

      this.files = json.files || [];
      this.parentId = json.parentId;
      this.rootFolder = json.rootFolder || {};
      this.preview = {};

      if (fileId) {
        const response = await fetch(`/api/drive/${this.driveId}/file/${fileId}`);
        this.preview = await response.json();
      }
    },
    selectFile(googleFile) {
      const folderId = this.$route.params.folderId;
      console.log('bbb', googleFile, googleFile.mimeType, googleFile.id);
      if (this.isFolder(googleFile)) {
        console.log('ccc', googleFile.id);
        this.$router.push({ name: 'folder', params: { driveId: this.driveId, folderId: googleFile.id } });
      } else
      if (this.isDocument(googleFile)) {
        this.$router.push({ name: 'folder', params: { driveId: this.driveId, folderId: folderId || this.driveId, fileId: googleFile.id } });
      }
    },
    isFolder(google) {
      return google.mimeType === 'application/vnd.google-apps.folder';
    },
    isDocument(google) {
      return google.mimeType === 'application/vnd.google-apps.document';
    },
    isImage(google) {
      switch (google.mimeType) {
        case 'application/vnd.google-apps.drawing':
        case 'image/png':
        case 'image/jpg':
        case 'image/jpeg':
          return true;
      }
      return false;
    },
    goToGDrive(google) {
      window.open('https://drive.google.com/open?id=' + google.id);
    },
    async sync(file) {
      file.syncing = true;
      try {
        const response = await fetch(`/api/drive/${this.driveId}/sync/${file.google.id}`, {
          method: 'post'
        });
      } finally {
      }
    },
    async syncAll() {
      this.rootFolder.syncing = true;
      try {
        const response = await fetch(`/api/drive/${this.driveId}/sync`, {
          method: 'post'
        });
      } finally {
      }
    },
    refresh() {
      window.location.reload();
    },
    copyEmail(event) {
      event.target.select();
    },
    async runInspect() {
      try {
        const response = await fetch(`/api/drive/${this.driveId}/inspect`);
        const inspected = await response.json();

        inspected.jobs = inspected.jobs || [];

        let runningJob = {
          type: ''
        };
        if (inspected.jobs?.length) {
          if (inspected.jobs[0].state === 'running') {
            runningJob = inspected.jobs[0];
          }
        }

        this.rootFolder.syncing = (runningJob.type === 'sync_all');

        for (const file of this.files) {
          const job = inspected.jobs.find(job => job.payload === file.id);
          file.syncing = !!job || (runningJob.type === 'sync_all');
        }
      } catch (error404) {}
    }
  }
}
</script>
