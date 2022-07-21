<template>
  <div class="container-fluid bg-light my-1">
    <div class="row py-1 align-items-center" v-if="selectedFile.fileName">
      <div class="col-8">
      {{ selectedFile.fileName }} <span v-if="selectedFile.version">#{{ selectedFile.version }}</span>
      </div>
    </div>
    <div class="row py-1 align-items-center" v-if="last_job.dateStr">
      <div class="col-8">
        <span v-if="last_job.kind === 'full'" class="fw-bold">Last full sync</span>
        <span v-else class="fw-bold">Last synced</span>
        <span class="small text-muted">{{ last_job.dateStr }}</span>
      </div>
      <div class="col-4 text-end">
        <button class="btn btn-light" v-if="!syncing" @click="syncSingle(selectedFile)">
          <i class="fa-solid fa-rotate" :class="{'fa-spin': syncing}"></i>
        </button>
      </div>
    </div>
  </div>

  <div class="container-fluid my-1">
    <ul class="list-group">
      <li class="list-group-item" v-if="activeTab !== 'html'">
        <a @click.prevent.stop="setActiveTab('html')">
          <i class="fa-brands fa-html5 me-1"></i>
          Preview
        </a>
      </li>
      <li class="list-group-item" v-if="activeTab !== 'markdown'">
        <a @click.prevent.stop="setActiveTab('markdown')">
          <i class="fa-brands fa-markdown me-1"></i>
          Markdown
        </a>
      </li>
      <li class="list-group-item" :class="{ 'active': activeTab === 'drive_backlinks' }">
        <a @click.prevent.stop="setActiveTab('drive_backlinks')">
          <i class="fa-solid fa-arrows-to-circle me-1"></i>
          BackLinks
        </a>
      </li>
      <li class="list-group-item" v-if="selectedFile.id && (isDocument(selectedFile) || isMarkdown(selectedFile))">
        <a @click.prevent.stop="downloadOdt(selectedFile.id)">
          <i class="fa fa-download me-1"></i>
          Download odt
        </a>
      </li>
      <li class="list-group-item" v-if="selectedFile.id && isImage(selectedFile)">
        <a @click.prevent.stop="downloadImage(selectedFile.id)">
          <i class="fa fa-download me-1"></i>
          Download image
        </a>
      </li>
    </ul>
  </div>

</template>
<script>
import {UtilsMixin} from './UtilsMixin.mjs';
import {UiMixin} from './UiMixin.mjs';

export default {
  name: 'PreviewHeader',
  mixins: [UtilsMixin, UiMixin],
  props: {
    folderPath: {
      type: String
    },
    activeTab: {
      type: String
    },
    selectedFile: Object
  }
};
</script>
