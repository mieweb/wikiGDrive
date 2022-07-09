<template>
  <table class="mui-table mui-table--bordered mui-table--hover mui-table--clickable" v-if="!notRegistered && files.length > 0">
    <thead>
      <tr>
        <th></th>
        <th>File</th>
        <th>Ver</th>
        <th>Modified</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      <tr v-if="folderPath !== '/'" @click="selectFile('..')">
        <td><i class="fa-solid fa-folder"></i></td>
        <td>
          ..
        </td>
        <td></td>
        <td></td>
      </tr>
      <tr v-for="file in files" :key="file.fileName" @click="selectFile(file.fileName)" :class="{'mui-tr--selected': file.fileName === selectedName}">
        <td>
          <i class="fa-solid fa-folder" v-if="isFolder(file)"></i>
          <i class="fa-solid fa-file-image" v-else-if="isImage(file)"></i>
          <i class="fa-solid fa-file-lines" v-else-if="isDocument(file) || isMarkdown(file)"></i>
          <i v-else class="fa-solid fa-file"></i>
        </td>
        <td>
          {{ file.title }}<br/>
          {{ file.fileName }}
        </td>
        <td>
          <a v-if="file.id && file.version" @click.prevent.stop="syncSingle(file)">
            #{{ file.version }}
            <i class="fa-solid fa-rotate" :class="{'fa-spin': isSyncing(file.id)}"></i>
          </a>
        </td>
        <td>{{ file.modifiedTime }}</td>
        <td v-if="file.id" @click.stop="goToGDocs(file.id)"><i class="fa-brands fa-google-drive"></i></td>
      </tr>
    </tbody>
  </table>
</template>
<script>
import {UtilsMixin} from './UtilsMixin.mjs';

export default {
  mixins: [ UtilsMixin ],
  props: {
    folderPath: {
      type: String
    },
    files: {
      type: Array
    },
    notRegistered: {
      type: Boolean
    }
  },
  computed: {
    selectedName() {
      const driveId = this.$root.drive.id;
      if (this.folderPath === '/') {
        return this.$route.path.replace(`/drive/${driveId}${this.folderPath}`, '');
      }
      return this.$route.path.replace(`/drive/${driveId}${this.folderPath}/`, '');
    },
    jobs() {
      return this.$root.jobs || [];
    },
    active_jobs() {
      return this.jobs.filter(job => ['waiting', 'running'].includes(job.state));
    }
  },
  methods: {
    selectFile(fileName) {
      const parts = this.folderPath.split('/').filter(s => s.length > 0);
      if (fileName === '..') {
        parts.pop();
      } else  {
        parts.push(fileName);
      }
      this.goToPath(`/${parts.join('/')}`);
    },
    isSyncing(id) {
      return !!this.active_jobs.find(job => (job.type === 'sync' && job.payload === id) || job.type === 'sync_all');
    }
  }
};
</script>
