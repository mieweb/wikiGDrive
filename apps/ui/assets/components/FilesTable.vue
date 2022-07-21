<template>
  <ul class="list-unstyled files-list" v-if="!notRegistered && files.length > 0">
    <li v-if="folderPath !== '/'" @click="selectFile('..' , {mimeType: 'application/vnd.google-apps.folder'})">
      <i class="fa-solid fa-folder"></i> ..
    </li>
    <li v-for="file in files" :key="file.fileName" @click="selectFile(file.fileName, file)" :class="{'active': file.fileName === selectedName}" :title="file.title">
        <i class="fa-solid fa-folder" v-if="isFolder(file)"></i>
        <i class="fa-solid fa-file-image" v-else-if="isImage(file)"></i>
        <i class="fa-solid fa-file-lines" v-else-if="isDocument(file) || isMarkdown(file)"></i>
        <i v-else class="fa-solid fa-file"></i>
        {{ file.fileName }} <span v-if="file.version">#{{ file.version }}</span>
    </li>
  </ul>
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
    selectFile(fileName, file) {
      const parts = this.folderPath.split('/').filter(s => s.length > 0);
      if (fileName === '..') {
        parts.pop();
      } else  {
        parts.push(fileName);
      }
      this.goToPath(`/${parts.join('/')}`);
      this.$emit('selected', fileName);

      if (file.mimeType !== 'application/vnd.google-apps.folder') {
        const sidebarEl = document.querySelector('.mainbar__sidebar');
        if (sidebarEl && sidebarEl.clientWidth === window.innerWidth) {
          this.$emit('collapse', true);
        }
      }
    },
    isSyncing(id) {
      return !!this.active_jobs.find(job => (job.type === 'sync' && job.payload === id) || job.type === 'sync_all');
    }
  },
  mounted() {
    window.addEventListener('resize', () => {
      const sidebarEl = document.querySelector('.mainbar__sidebar');
      if (window.innerWidth > 400) {
        if (sidebarEl && sidebarEl.clientWidth === 0) {
          this.$emit('collapse', false);
        }
      } else {
        if (sidebarEl && sidebarEl.clientWidth > 0) {
          if (this.selectedName) {
            this.$emit('collapse', true);
          }
        }
      }

    }, true);
  }
};
</script>
