<template>
  <div class="container mainbar__content-height">
    <StatusToolBar :active-tab="activeTab" />

    <div class="overflow-scroll d-flex flex-row mt-3">

      <div class="flex-column order-0 w-auto">
        <div class="d-block">
          <div class="btn-group-vertical w-100">
            <button :disabled="active_jobs.length > 0" class="btn btn-outline-primary me-2" v-if="selectedFile.id && selectedFile.id !== 'TO_FILL' && selectedFile.id !== 'UNKNOWN'" @click.prevent="$emit('sync', { $event, file: selectedFile })">Sync Single</button>
            <button :disabled="active_jobs.length > 0" class="btn btn-outline-danger me-2" v-id="drive.name" @click.prevent="syncAll">Sync All</button>
          </div>
        </div>
        <div class="d-block mt-3" v-if="!isGDocsPreview && drive.name">
          <h6>Workflows <a href="#workflows"><i class="fa-solid fa-edit"></i></a></h6>
          <div class="btn-group-vertical w-100">
            <div v-for="(workflow_job, id) in workflow_jobs" :key="id">
              <a v-if="!workflow_job.hide_in_menu" class="btn btn-outline-secondary me-2 w-100" @click.prevent="runAction($event, id)">
                {{ workflow_job.name }}
              </a>
            </div>
          </div>
        </div>
      </div>
      <div class="flex-grow-1 flex-shrink-1 overflow-scroll border-left-0-not-first ms-3">
        <div class="card">
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
  </div>
</template>
<script>
import {disableElement, UtilsMixin} from './UtilsMixin.ts';
import {UiMixin} from './UiMixin.ts';
import StatusToolBar from './StatusToolBar.vue';
import yaml from 'js-yaml';

export default {
  name: 'JobsViewer',
  mixins: [UtilsMixin, UiMixin],
  props: {
    selectedFile: Object,
    activeTab: {
      type: String
    }
  },
  data() {
    return {
      workflow_jobs: []
    };
  },
  components: {StatusToolBar},
  created() {
    this.fetchConfig();
  },
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
    },
    async fetchConfig() {
      const response = await this.authenticatedClient.fetchApi(`/api/config/${this.driveId}`);
      const json = await response.json();
      if (json.config?.actions_yaml) {
        const actions_yaml = json.config?.actions_yaml;
        this.workflow_jobs = {};
        yaml.loadAll(actions_yaml, (workflow) => {
          this.workflow_jobs = workflow.jobs;
        });
      }
    },
    async runAction(event, id) {
      await disableElement(event, async () => {
        await this.authenticatedClient.fetchApi(`/api/run_action/${this.driveId}/${id}`, {
          method: 'post',
          headers: {
            'Content-type': 'application/json'
          },
          body: JSON.stringify({
            selectedFileId: this.selectedFile.id
          })
        });
      });
    },
  }
};
</script>
