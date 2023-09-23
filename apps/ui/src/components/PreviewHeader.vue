<template>
  <div v-if="isDocument(selectedFile) || isImage(selectedFile) || isMarkdown(selectedFile)">
    <div class="row py-1 align-items-center" v-if="selectedFile.fileName">
      <div class="col-8">
        <strong>{{ selectedFile.fileName }}</strong>
        <span v-if="selectedFile.version">#{{ selectedFile.version }}</span>
        <span v-if="selectedFile.modifiedTime" class="small text-muted">&nbsp;{{ selectedFile.modifiedTime }}</span>
      </div>
    </div>
    <div class="row py-1 align-items-center" v-if="last_job.dateStr">
      <div class="col-8">
        <span v-if="last_job.kind === 'full'" class="fw-bold">Last full sync</span>
        <span v-else class="fw-bold">Last synced</span>
        <span class="small text-muted">&nbsp;{{ last_job.dateStr }}</span>
        <span v-if="last_job.durationStr" class="small text-muted">&nbsp;({{ last_job.durationStr }})</span>
      </div>
      <div class="col-4 text-end">
        <button class="btn btn-white bg-white text-primary" v-if="selectedFile.id && !syncing" @click="syncSingle($event, selectedFile)" title="Sync single">
          <i class="fa-solid fa-rotate" :class="{'fa-spin': syncing}"></i>
        </button>
      </div>
    </div>
  </div>

  <form class="row py-1" @submit.prevent="commitSingle" v-if="selectedFile.status">
    <div class="col">
      <div class="input-group mb-1">
        <input v-model="commitMsg" type="text" class="form-control border-light" placeholder="Commit message..." aria-label="Commit message" aria-describedby="commit-button">
        <button class="btn btn-white bg-white text-primary" type="submit" id="commit-button" title="Commit button">
          <i class="fa-solid fa-code-commit"></i>
        </button>
      </div>
    </div>
  </form>

  <div class="d-flex py-1" v-if="isDocument(selectedFile) || isImage(selectedFile) || isMarkdown(selectedFile)">
    <div class="flex-grow-1"></div>
    <div>
      <button v-if="isGoogleId(selectedFile.id)" @click.prevent.stop="openExternal(selectedFile)" class="btn btn-white text-primary ml-1" type="button" aria-label="Edit" title="Edit">
        <i class="fa-solid fa-file-pen me-1"></i>
      </button>

      <button v-if="activeTab !== 'html'" @click.prevent.stop="setActiveTab('html')" class="btn btn-white text-primary ml-1" type="button" aria-label="Preview" title="Preview">
        <i class="fa-solid fa-eye me-1"></i>
      </button>
      <button v-if="activeTab !== 'markdown'" @click.prevent.stop="setActiveTab('markdown')" class="btn btn-white text-primary ml-1" type="button" aria-label="Markdown" title="Markdown" >
        <i class="fa-brands fa-markdown me-1"></i>
      </button>
      <button v-if="isGoogleId(selectedFile.id) && (isDocument(selectedFile) || isMarkdown(selectedFile))" @click.prevent.stop="downloadOdt(selectedFile.id)" class="btn btn-white text-primary ml-1" type="button" aria-label="Download odt" title="Download odt" >
        <i class="fa fa-download me-1"></i>
      </button>
      <button v-if="isGoogleId(selectedFile.id) && isImage(selectedFile)" @click.prevent.stop="downloadImage(selectedFile.id)" class="btn btn-white text-primary ml-1" type="button" aria-label="Download image" title="Download image" >
        <i class="fa fa-download me-1"></i>
      </button>
      <a v-if="selectedFile.previewUrl" :href="selectedFile.previewUrl" target="_blank" class="btn btn-white text-primary ml-1" type="button" aria-label="Preview in new window" title="Preview in new window">
        <i class="fa-regular fa-window-maximize me-1"></i>
      </a>
    </div>
    <div class="ms-5">
      <button v-if="drive.tocFilePath" @click.prevent.stop="goToPath(drive.tocFilePath)" class="btn btn-white text-primary ml-1" type="button" aria-label="Table of Contents" title="Table of Contents">
        <i class="fa-solid fa-list"></i>
      </button>
      <button @click.prevent.stop="setActiveTab('drive_backlinks')" class="btn btn-white text-primary ml-1" type="button" aria-label="Backlinks" title="Backlinks">
        <i class="fa-solid fa-link"></i>
      </button>
      <button v-if="drive.navFilePath" @click.prevent.stop="goToPath(drive.navFilePath)" class="btn btn-white text-primary mx-1" type="button" aria-label="Navigation" title="Navigation">
        <i class="fa-solid fa-ellipsis-vertical"></i>
      </button>

      <button v-if="!isAddon && isGoogleId(selectedFile.id) && (isDocument(selectedFile) || isMarkdown(selectedFile))" @click.prevent.stop="openAddonView(selectedFile.id)" class="btn btn-white text-primary ml-1" type="button" aria-label="Google addon mode" title="Google addon mode" >
        <i class="fa-solid fa-arrows-left-right"></i>
      </button>

      <button v-if="isGoogleId(selectedFile.id) && (isDocument(selectedFile) || isMarkdown(selectedFile))" @click.prevent.stop="reportBug(selectedFile)" class="btn btn-white text-primary ml-1" type="button" aria-label="Report issue" title="Report issue" >
        <i class="fa-solid fa-bug"></i>
      </button>

    </div>
  </div>

</template>
<script>
import {UtilsMixin} from './UtilsMixin.ts';
import {UiMixin} from './UiMixin.ts';
import {GitMixin} from './GitMixin.ts';

export default {
  name: 'PreviewHeader',
  mixins: [UtilsMixin, UiMixin, GitMixin],
  props: {
    folderPath: {
      type: String
    },
    activeTab: {
      type: String
    },
    selectedFile: Object
  },
  data() {
    return {
      commitMsg: ''
    };
  },
  methods: {
    async commitSingle() {
      if (!this.commitMsg) {
        alert('No commit message');
        return;
      }

      const folderPath = this.folderPath.endsWith('/') ? this.folderPath : this.folderPath + '/';
      const filePath = folderPath + this.selectedFile.fileName;

      await this.commit({
        message: this.commitMsg,
        filePath
      });
      this.commitMsg = '';
    },
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    fetch() {},
    reportBug(selectedFile) {
      const url = 'https://github.com/mieweb/wikiGDrive/issues/new?' + new URLSearchParams({
        labels: 'markdown',
        title: 'Incorrect result',
        template: 'markdown_report.md',
        body: `FileId: ${selectedFile.id}\nURL: ${window.location.toString()}\nGoogle Docs: https://drive.google.com/open?id=${selectedFile.id}`

      }).toString();

      window.open(url, '_blank');
    },
    openAddonView(fileId) {
      this.$router.push({
        name: 'gdocs',
        params: {
          driveId: this.driveId,
          fileId
        }
      });
    },
    openExternal(file) {
      if (file.id === 'UNKNOWN' || file.id === 'TO_FILL') {
        return;
      }
      if (this.isFolder(file)) {
        this.openWindow(`https://drive.google.com/open?id=${file.id}`, '_blank');
      } else
      if (file.id) {
        this.openWindow(`https://drive.google.com/open?id=${file.id}`, '_blank');

      }
    },
    isGoogleId(id) {
      if (!id) return false;
      if (id.length === 0) return false;
      if (id.indexOf(':') > -1) return false;
      if (id === 'UNKNOWN') return false;
      if (id === 'TO_FILL') return false;

      return true;
    }
  }
};
</script>
