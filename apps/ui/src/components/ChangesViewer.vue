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
    }
  }
};
</script>
