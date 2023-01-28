<template>
  <ul class="nav nav-pills flex-column files-list" v-if="files.length > 0" :title="folderPath">
    <li v-for="file in files" :key="(file.realFileName || file.fileName)" :title="file.title" @contextmenu.prevent.stop="showContextMenu($event, file)">
      <div class="nav-item files-list__item"
           :class="{'active': (file.realFileName || file.fileName) === selectedName, 'text-git-del': file.status === 'D', 'text-git-new': file.status === 'N', 'text-git-mod': file.status === 'M', 'text-muted': isRedirect(file) || isConflict(file)}"
           :style="{ 'padding-left': (8 + level * 16) + 'px'}"
           @click="selectFile((file.realFileName || file.fileName), file)">
        <i class="fa-solid fa-person-walking-luggage" v-if="isRedirect(file)"></i>
        <i class="fa-solid fa-car-crash" v-else-if="isConflict(file)"></i>
        <i @click.prevent="openExternal(file)" class="fa-solid fa-folder" v-else-if="isFolder(file)"></i>
        <i @click.prevent="openExternal(file)" class="fa-solid fa-file-image" v-else-if="isImage(file)"></i>
        <i @click.prevent="openExternal(file)" class="fa-solid fa-file-lines" v-else-if="isDocument(file) || isMarkdown(file)"></i>
        <i @click.prevent="openExternal(file)" v-else class="fa-solid fa-file"></i>
        <span class="file-name">{{ file.realFileName || file.fileName }}</span>
        <span v-if="changesMap[file.id]" class="btn" @click.prevent="$emit('sync', file)">
          <i class="fa-solid fa-rotate" :class="{'fa-spin': (jobsMap['sync_all'] || jobsMap['transform'] || jobsMap[file.id]) }"></i>
          #{{ changesMap[file.id].version }}
        </span>
      </div>
      <FilesTreeLeaf v-if="isFolder(file) && isExpanded(file)" :folderPath="folderPath === '/' ? '/' + (file.realFileName || file.fileName) : folderPath + '/' + (file.realFileName || file.fileName)" :level="1 + level" @selected="$emit('selected', $event)" />
    </li>
  </ul>
  <ContextMenu ref="contextMenu">
    <template v-slot="slotProps">
      <div class="dropdown" v-if="slotProps.ctx">
        <ul class="dropdown-menu show">
          <li><button class="dropdown-item" type="button" @click="removeFile(slotProps.ctx)"><i class="fa-solid fa-trash"></i> Remove</button></li>
        </ul>
      </div>
    </template>
  </ContextMenu>
</template>
<script>
import {UtilsMixin} from './UtilsMixin.ts';
import ContextMenu from './ContextMenu.vue';

function inDir(dirPath, filePath) {
  if (dirPath === filePath) {
    return true;
  }
  return filePath.startsWith(dirPath + '/');
}

export default {
  name: 'FilesTreeLeaf',
  components: { ContextMenu },
  mixins: [ UtilsMixin ],
  emits: ['selected', 'collapse', 'sync'],
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
    this.emitter.on('tree:changed', () => {
      this.fetchFolder();
    });
    this.fetchFolder();
  },
  watch: {
    $route() {
      this.fetchFolder();
    }
  },
  methods: {
    isExpanded(file) {
      return !!this.expanded[file.fileName];
    },
    async fetchFolder() {
      if (!this.driveId) {
        return;
      }
      const pathContent = await this.FileClientService.getFile('/' + this.driveId + this.folderPath);
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
        this.goToPath(`/${parts.join('/')}${this.$route.hash}`);
      } else {
        this.goToPath(`/${parts.join('/')}${this.$route.hash}`);
      }
      this.$emit('selected', fileName);

      if (file.mimeType !== 'application/vnd.google-apps.folder') {
        const sidebarEl = document.querySelector('.mainbar__sidebar');
        if (sidebarEl && sidebarEl.clientWidth === window.innerWidth) {
          this.$emit('collapse', true);
        }
      }
    },
    openExternal(file) {
      if (file.id === 'UNKNOWN') {
        return;
      }
      if (this.isFolder(file)) {
        this.openWindow(`https://drive.google.com/open?id=${file.id}`, '_blank');
      } else
      if (file.id) {
        this.openWindow(`https://drive.google.com/open?id=${file.id}`, '_blank');
      }
    },
    showContextMenu(event, ctx) {
      this.$refs.contextMenu.open(event, ctx);
    },
    async removeFile(file) {
      if (!window.confirm('Are you sure?')) {
        this.$refs.contextMenu.close();
        return;
      }
      const path = (this.folderPath.endsWith('/') ? this.folderPath : this.folderPath + '/') + file.realFileName;
      await this.FileClientService.removeFile('/' + this.driveId + path);
      this.$refs.contextMenu.close();
      await this.fetchFolder();
    }
  }
};
</script>
