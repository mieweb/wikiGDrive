<template>
  <div class="container mainbar__content-height">
    <StatusToolBar :active-tab="activeTab" />

    <div>
      <div class="card-footer" v-if="active_jobs.length === 0">
        <div class="btn-group">
          <a class="btn btn-outline-primary me-2" v-if="selectedFile.id && selectedFile.id !== 'TO_FILL'" @click.prevent="$emit('sync', { $event, file: selectedFile })">Sync Single</a>
          <a class="btn btn-outline-danger me-2" v-if="drive.name" @click.prevent="syncAll">Sync All</a>
          <a class="btn btn-outline-secondary me-2" v-if="!isGDocsPreview && drive.name && selectedFile.id" @click.prevent="$emit('transform', $event, selectedFile)">Transform Single Markdown</a>
          <a class="btn btn-outline-secondary me-2" v-if="!isGDocsPreview && drive.name" @click.prevent="transformAll">Transform All Markdown</a>
          <a class="btn btn-outline-secondary me-2" v-if="!isGDocsPreview && drive.name" @click.prevent="renderPreview">Render Preview</a>
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

          <table class="table table-bordered jobs-list mt-3">
            <thead>
            <tr>
              <th>Job</th>
              <th>Started</th>
              <th>Finished</th>
            </tr>
            </thead>

            <tbody v-if="active_jobs_reverse.length > 0">
            <tr v-for="(job, idx) of active_jobs_reverse" :key="idx" class="jobs-list__item" :class="{ active: 'running' === job.state }">
              <td>{{ job.title }}</td>
              <td>{{ job.startedStr || job.state }}</td>
              <td>
                <span v-if="job.progress && job.progress.total > job.progress.completed">&nbsp;{{ job.progress.completed }} / {{ job.progress.total }}</span>
                <a v-if="job.id && job.started" class="btn float-end" :href="'#drive_logs:job-' + job.id" @click.prevent="showLogs(job)">Logs</a>
              </td>
            </tr>
            </tbody>

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
  name: 'JobsViewer',
  mixins: [UtilsMixin, UiMixin],
  props: {
    selectedFile: Object,
    activeTab: {
      type: String
    }
  },
  components: {StatusToolBar},
  computed: {
    active_jobs_reverse() {
      return [].concat(this.active_jobs)
        .map(a => {
          return {
            ...a,
            finishedStr: a.finished ? new Date(a.finished).toISOString() : undefined,
            startedStr: a.started ? new Date(a.started).toISOString() : undefined,
            durationStr: a.started && a.finished ? Math.round((+new Date(a.finished) - +new Date(a.started)) / 100)/10 + 's' : undefined
          };
        })
        .reverse();
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
    showLogs(job) {
      this.$router.push(`/drive/${this.driveId}#drive_logs:job-${job.id}`);
    }
  }
};
</script>
