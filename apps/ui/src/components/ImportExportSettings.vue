<template>
  <div class="container mainbar__content-height">
    <StatusToolBar :active-tab="activeTab" />

    <div class="overflow-scroll d-flex flex-row mt-3">
      <SettingsSidebar />

      <div class="card flex-column order-0 flex-grow-1 flex-shrink-1 overflow-scroll border-left-0">
        <div class="card-body">
          <h4>.wgd-local-log.csv</h4>
          <p>This includes log which is responsible for conflicts and rename history.</p>

          <button class="btn btn-secondary" type="button" @click="exportData()">Export log data</button>
          <button class="btn btn-danger" type="button" @click="importData()">Import log data</button>
        </div>
      </div>
    </div>
  </div>
</template>
<script>
import {UtilsMixin} from './UtilsMixin.ts';
import {DangerMixin} from './DangerMixin.ts';
import StatusToolBar from './StatusToolBar.vue';
import SettingsSidebar from './SettingsSidebar.vue';

export default {
  mixins: [UtilsMixin, DangerMixin],
  components: {
    SettingsSidebar,
    StatusToolBar
  },
  props: {
    activeTab: {
      type: String
    },
    drive_config: {}
  },
  computed: {
    config() {
      return this.drive_config?.config || {};
    },
    transform_subdir() {
      return this.config?.transform_subdir || '';
    }
  },
  methods: {
    async importData() {
      if (!window.confirm('Are you sure to overwrite data?')) {
        return;
      }

      const fileContent = await new Promise(resolve => {
        const input = document.createElement('input');
        input.type = 'file';

        input.onchange = e => {
          const file = e.target.files[0];

          // setting up the reader
          const reader = new FileReader();
          reader.readAsText(file,'UTF-8');

          // here we tell the reader what to do when it's done reading...
          reader.onload = readerEvent => {
            const content = readerEvent.target.result; // this is the content!
            resolve(content);
          };
        };

        input.click();
      });

      const filePath = `/${this.driveId}${this.transform_subdir}/.wgd-local-log.csv`;
      await this.FileClientService.saveFile(filePath, fileContent);
    },
    async exportData() {
      const fullUrl = `/api/file/${this.driveId}${this.transform_subdir}/.wgd-local-log.csv`;
      window.open(fullUrl, '_blank');
    }
  }
};
</script>
