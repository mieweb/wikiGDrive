<template>
  <div class="x-container">
    <div v-if="changes.length > 0">
      <h4>Changed on gdocs</h4>
      <ul class="list-group">
        <li class="list-group-item" v-for="(file, idx) of changes" :key="idx">
          <a>{{ file.name }} #{{ file.version }}</a>
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
    selectedFile: Object
  }
};
</script>
