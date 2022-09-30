<template>
  <div class="container mainbar__content-height">
    <StatusToolBar :active-tab="activeTab" />

    <div v-if="changes.length > 0" class="overflow-scroll">
      <h4>Changed on gdocs</h4>
      <table class="table table-bordered jobs-list">
        <thead>
        <tr>
          <th>
            Document
          </th>
          <th>
            Modified
          </th>
        </tr>
        </thead>
        <tbody>
          <tr v-for="(file, idx) of fileChanges" :key="idx">
            <td>
              <a href="#" @click.prevent="gotoFile(file.id)">{{ file.name }} #{{ file.version }}</a>
              <button class="btn is-right" @click.prevent="$emit('sync', file)" v-if="!syncing">
                <i class="fa-solid fa-rotate" :class="{'fa-spin': syncing}"></i>
              </button>
            </td>
            <td>
              {{ file.modifiedTime }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="container-fluid bg-light my-1">
      <div class="row py-1 align-items-center" v-if="last_job.dateStr">
        <div class="col-8">
          <span v-if="last_job.kind === 'full'" class="fw-bold">Last full sync </span>
          <span v-else class="fw-bold">Last synced </span>
          <span class="small text-muted">{{ last_job.dateStr }} </span>
          <span v-if="last_job.durationStr" class="small text-muted">&nbsp;{{ last_job.durationStr }}</span>
        </div>
        <div v-if="last_transform.durationStr" class="col-8">
          <span class="fw-bold">Last transform took</span>
          <span class="small text-muted">&nbsp;{{ last_transform.durationStr }}</span>
        </div>
      </div>
    </div>

    <div class="btn-group" v-if="!syncing">
      <a class="btn btn-outline-primary me-2" v-if="selectedFile.id" @click.prevent="$emit('sync', selectedFile)">Sync Single</a>
      <a class="btn btn-outline-danger me-2" v-if="drive.name" @click.prevent="syncAll">Sync All</a>
      <a class="btn btn-outline-secondary me-2" v-if="!isGDocsPreview && drive.name && selectedFile.id" @click.prevent="$emit('transform', selectedFile)">Transform Single Markdown</a>
      <a class="btn btn-outline-secondary me-2" v-if="!isGDocsPreview && drive.name" @click.prevent="transformAll">Transform All Markdown</a>
      <a class="btn btn-outline-secondary me-2" v-if="!isGDocsPreview && drive.name" @click.prevent="renderPreview">Render Preview</a>
    </div>
    <table class="table table-bordered jobs-list" v-else>
      <tbody>
        <tr v-for="(job, idx) of active_jobs" :key="idx" class="jobs-list__item" :class="{ active: 'running' === job.state }">
          <td>{{ job.title }}</td>
          <td>
            <span v-if="job.progress && job.progress.total > job.progress.completed">&nbsp;{{ job.progress.completed }} / {{ job.progress.total }}</span>
            <span v-else>{{ job.state }}</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
<script>
import {UtilsMixin} from './UtilsMixin.mjs';
import {UiMixin} from './UiMixin.mjs';
import StatusToolBar from './StatusToolBar.vue';

export default {
  name: 'ChangeViewer',
  mixins: [UtilsMixin, UiMixin],
  props: {
    selectedFile: Object,
    activeTab: {
      type: String
    }
  },
  components: {StatusToolBar},
  computed: {
    fileChanges() {
      return this.changes.filter(change => change.mimeType !== 'application/vnd.google-apps.folder');
    }
  },
  methods: {
    async gotoFile(fileId) {
      if (fileId) {
        const response = await this.authenticatedClient.fetchApi(`/api/gdrive/${this.driveId}/${fileId}`);

        const path = response.headers.get('wgd-path') || '';
        const fileName = response.headers.get('wgd-file-name') || '';
        const selectedFile = {
          fileName,
          folderId: response.headers.get('wgd-google-parent-id'),
          version: response.headers.get('wgd-google-version'),
          modifiedTime: response.headers.get('wgd-google-modified-time'),
          fileId: response.headers.get('wgd-google-id'),
          mimeType: response.headers.get('wgd-mime-type'),
          previewUrl: response.headers.get('wgd-preview-url'),
          path: path
        };

        const contentDir = response.headers.get('wgd-content-dir');
        if (selectedFile.path) {
          const path = (contentDir + selectedFile.path).replace('//', '/');
          this.$router.push(`/drive/${this.driveId}${path}`);
        }
      }
    }
  }
};
</script>
