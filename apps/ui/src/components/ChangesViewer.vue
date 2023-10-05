<template>
  <div class="container mainbar__content-height">
    <StatusToolBar :active-tab="activeTab" />

    <div>
      <div class="card mt-3">
        <div v-if="changes.length > 0" class="card-header">
          Changed on gdocs
        </div>
        <div v-if="changes.length > 0" class="card-body">
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
            <tr v-for="(file, idx) of fileChanges" :key="idx" :class="{ 'is-warning': selectedFile && file.id === selectedFile.id }">
              <td>
                <a href="#" @click.prevent="gotoFile(file.id)">{{ file.name }} #{{ file.version }}</a>
                <button class="btn is-right" @click.prevent="$emit('sync', { $event, file})" v-if="!syncing">
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
        <div class="card-footer" v-if="active_jobs.length === 0">
          <div class="btn-group">
            <a class="btn btn-outline-primary me-2" v-if="selectedFile.id && selectedFile.id !== 'TO_FILL'" @click.prevent="$emit('sync', { $event, file: selectedFile })">Sync Single</a>
            <a class="btn btn-outline-danger me-2" v-if="drive.name" @click.prevent="syncAll">Sync All</a>
            <a class="btn btn-outline-secondary me-2" v-if="!isGDocsPreview && drive.name && selectedFile.id" @click.prevent="$emit('transform', $event, selectedFile)">Transform Single Markdown</a>
            <a class="btn btn-outline-secondary me-2" v-if="!isGDocsPreview && drive.name" @click.prevent="transformAll">Transform All Markdown</a>
            <a class="btn btn-outline-secondary me-2" v-if="!isGDocsPreview && drive.name" @click.prevent="renderPreview">Render Preview</a>
          </div>
        </div>
      </div>

      <div class="card mt-3">
        <div class="card-header">
          Jobs
        </div>
        <div class="card-body">

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

          <table class="table table-bordered jobs-list mt-3" v-if="active_jobs.length > 0">
            <thead>
            <th>Job</th>
            <th>Progress</th>
            </thead>
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

          <div v-if="active_jobs.length === 0" class="mt-3">
            No active jobs
          </div>

        </div>
      </div>

      <div class="card mt-3" v-if="archive.length > 0">
        <div class="card-header">
          Jobs done
        </div>
        <div class="card-body">
            <table class="table table-bordered jobs-list mt-3">
            <thead>
            <th>Job</th>
            <th>Started</th>
            <th>Finished</th>
            </thead>
            <tbody>
            <tr v-for="(job, idx) of archive" :key="idx" class="jobs-list__item" :class="{ active: 'running' === job.state, 'text-danger': 'failed' === job.state, 'text-warning': job.progress && job.progress.warnings > 0 }">
              <td>{{ job.title }}</td>
              <td>{{ job.startedStr }}</td>
              <td>
                {{ job.finishedStr }}
                ({{ job.durationStr }})
                <a class="btn float-end" :href="'#drive_logs:job-' + job.id" @click.prevent="showLogs(job)">Logs</a>
              </td>
            </tr>
            </tbody>
          </table>
        </div>

      </div>

    </div>
  </div>
</template>
<script>
import {UtilsMixin} from './UtilsMixin.ts';
import {UiMixin} from './UiMixin.ts';
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
    },
    archive() {
      const arr = [].concat(this.$root.archive);
      arr.sort((a, b) => b.finished - a.finished);

      return arr.map(a => {
        return {
          ...a,
          finishedStr: new Date(a.finished).toISOString(),
          startedStr: new Date(a.started).toISOString(),
          durationStr: Math.round((+new Date(a.finished) - +new Date(a.started)) / 100)/10 + 's'
        };
      });
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
          status: response.headers.get('wgd-git-status'),
          path: path
        };

        const contentDir = response.headers.get('wgd-content-dir');
        if (selectedFile.path) {
          const path = (contentDir + selectedFile.path).replace('//', '/');
          this.$router.push(`/drive/${this.driveId}${path}`);
        }
      }
    },
    showLogs(job) {
      this.$router.push(`/drive/${this.driveId}#drive_logs:job-${job.id}`);
    }
  }
};
</script>
