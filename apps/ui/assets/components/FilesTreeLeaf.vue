<template>
  <ul class="nav nav-pills flex-column files-list" v-if="files.length > 0" :title="folderPath">
    <li v-for="file in files" :key="file.fileName" :title="file.title">
      <div class="nav-item files-list__item"
           :class="{'active': file.fileName === selectedName, 'text-danger': (file.status === 'D' || file.status === 'N'), 'text-success': file.status === 'M'}"
           :style="{ 'padding-left': (8 + level * 16) + 'px'}"
           @click="selectFile(file.fileName, file)">
        <i class="fa-solid fa-folder" v-if="isFolder(file)"></i>
        <i class="fa-solid fa-file-image" v-else-if="isImage(file)"></i>
        <i class="fa-solid fa-file-lines" v-else-if="isDocument(file) || isMarkdown(file)"></i>
        <i v-else class="fa-solid fa-file"></i>
        <span class="file-name">{{ file.fileName }}</span>
        <span v-if="changesMap[file.id]" class="btn" @click.prevent="$emit('sync', file)">
          <i class="fa-solid fa-rotate" :class="{'fa-spin': (jobsMap['sync_all'] || jobsMap['transform'] || jobsMap[file.id]) }"></i>
          #{{ changesMap[file.id].version }}
        </span>
      </div>
      <FilesTreeLeaf v-if="isFolder(file) && isExpanded(file)" :folderPath="folderPath === '/' ? '/' + file.fileName : folderPath + '/' + file.fileName" :level="1 + level" @selected="$emit('selected', $event)" />
    </li>
  </ul>
</template>
<script>
import {UtilsMixin} from './UtilsMixin.mjs';

function inDir(dirPath, filePath) {
  if (dirPath === filePath) {
    return true;
  }
  return filePath.startsWith(dirPath + '/');
}

export default {
  name: 'FilesTreeLeaf',
  mixins: [ UtilsMixin ],
  props: {
    folderPath: {
      type: String
    },
    level: {
      type: Number,
      default: 0
    }
  },
  data() {
    return {
      files: [],
      expanded: {}
    };
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
  created() {
    this.fetchFolder(this.driveId, this.folderPath);
  },
  watch: {
    $route() {
      this.fetchFolder(this.driveId, this.folderPath);
    }
  },
  methods: {
    isExpanded(file) {
      return !!this.expanded[file.fileName];

    },
    async fetchFolder(driveId, filePath) {
      const pathContent = await this.FileClientService.getFile('/' + driveId + filePath);
      this.files = pathContent.files || [];
      this.expanded = {};
      for (const file of this.files) {
        if (inDir(file.fileName, this.selectedName)) {
          this.expanded[file.fileName] = true;
        }
      }
    },
    selectFile(fileName, file) {
      const parts = this.folderPath.split('/').filter(s => s.length > 0);
      parts.push(fileName);
      if (file.mimeType === 'application/vnd.google-apps.folder') {
        this.expanded[file.fileName] = !this.expanded[file.fileName];
        this.goToPath(`/${parts.join('/')}#drive_tools`);
      } else {
        this.goToPath(`/${parts.join('/')}`);
      }
      this.$emit('selected', fileName);

      if (file.mimeType !== 'application/vnd.google-apps.folder') {
        const sidebarEl = document.querySelector('.mainbar__sidebar');
        if (sidebarEl && sidebarEl.clientWidth === window.innerWidth) {
          this.$emit('collapse', true);
        }
      }
    }
  }
};
</script>
