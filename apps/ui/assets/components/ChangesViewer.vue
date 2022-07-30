<template>
  <div class="x-container">
    <div class="row py-1">
      <div class="col-12 text-end">
        <router-link v-if="!isGDocsPreview" :to="{ name: 'drive', params: { driveId }, hash: '#drive_logs' }" class="btn btn-white text-primary ml-1" type="button" aria-label="Logs" title="Logs">
          <i class="fa-solid fa-computer me-1"></i>
        </router-link>
        <router-link v-if="!isGDocsPreview" :to="{ name: 'drive', params: { driveId }, hash: '#drive_config' }" class="btn btn-white text-primary ml-1" type="button" aria-label="Settings" title="Settings">
          <i class="fa-solid fa-gear me-1"></i>
        </router-link>
      </div>
    </div>

    <div v-if="changes.length > 0">
      <h4>Changed on gdocs</h4>
      <ul class="list-group">
        <li class="list-group-item" v-for="(file, idx) of changes" :key="idx">
          <a href="#" @click.prevent="gotoFile(file.id)">{{ file.name }} #{{ file.version }}</a>

          <button class="btn is-right" @click.prevent="$emit('sync', file)" v-if="!syncing">
            <i class="fa-solid fa-rotate" :class="{'fa-spin': syncing}"></i>
          </button>
        </li>
      </ul>
    </div>

    <div class="container-fluid bg-light my-1">
      <div class="row py-1 align-items-center" v-if="last_job.dateStr">
        <div class="col-8">
          <span v-if="last_job.kind === 'full'" class="fw-bold">Last full sync</span>
          <span v-else class="fw-bold">Last synced</span>
          <span class="small text-muted">{{ last_job.dateStr }}</span>
        </div>
      </div>
    </div>

    <div class="btn-group-vertical" v-if="!syncing">
      <a class="btn btn-primary" v-if="selectedFile.id" @click.prevent="$emit('sync', selectedFile)">Sync single</a>
      <a class="btn btn-danger" v-if="drive.name" @click.prevent="syncAll">Sync All</a>
    </div>
    <ul class="list-group" v-else>
      <li v-for="(job, idx) of active_jobs" :key="idx">
        <a>{{ job.title }}</a>
      </li>
    </ul>

  </div>
</template>
<script>
import {UtilsMixin} from './UtilsMixin.mjs';
import {UiMixin} from './UiMixin.mjs';

export default {
  name: 'ChangeViewer',
  mixins: [UtilsMixin, UiMixin],
  props: {
    selectedFile: Object,
    activeTab: {
      type: String
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
          path: path
        };

        if (selectedFile.path) {
          this.$router.push(`/drive/${this.driveId}${selectedFile.path}`);
        }
      }
    }
  }
};
</script>
