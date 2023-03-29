<template>
  <ul class="nav nav-pills flex-column order-0 files-list" v-if="tree.length > 0">
    <li v-for="file in tree" :key="file.path" :title="file.path" @contextmenu.prevent.stop="showContextMenu($event, file)">
      <div class="nav-item files-list__item"
           :class="{'active': file.path === selectedPath, 'text-git-del': file.status === 'D', 'text-git-new': file.status === 'N', 'text-git-mod': file.status === 'M'}"
           :style="{ 'padding-left': (8 + level * 16) + 'px'}"
           >
        <i @click.prevent="openExternal(file)" class="fa-solid fa-folder" v-if="file.children.length > 0"></i>
        <i @click.prevent="openExternal(file)" v-else class="fa-solid fa-file"></i>
        <span v-if="!file.children.length">
          <input name="filePath" type="checkbox" :value="file.path" @click="$emit('toggle', file.path)" :checked="checked[file.path]" />
        </span>
        <span v-else>
          <input name="filePath" type="checkbox" :value="file.path" @click="$emit('toggleDir', file.path)" :checked="checkedDirs[file.path]" />
        </span>
        <span class="file-name m-1" @click="$emit('selected', file)">{{ file.fileName }}</span>
      </div>
      <GitSideBarLeaf
          v-if="file.children"
          :tree="file.children"
          :level="1 + level"
          :checked="checked"
          :checkedDirs="checkedDirs"
          :selectedPath="selectedPath"
          @selected="$emit('selected', $event)"
          @toggleDir="$emit('toggleDir', $event)"
          @toggle="$emit('toggle', $event)"
      />
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

export default {
  name: 'GitSideBarLeaf',
  components: { ContextMenu },
  mixins: [ UtilsMixin ],
  props: {
    selectedPath: String,
    tree: Array,
    level: {
      type: Number,
      default: 0
    },
    checked: Object,
    checkedDirs: Object
  },
  data() {
    return {
      files: [],
      expanded: {}
    };
  },
  computed: {},
  methods: {
    async openExternal(file) {
      if (!file) {
        return;
      }
      if (!file.path) {
        return;
      }

      const response = await this.FileClientService.getFile(`/${this.driveId}/${file.path}`);
      if (response.googleId) {
        this.openWindow(`https://drive.google.com/open?id=${response.googleId}`, '_blank');
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
      const path = file.path;
      await this.FileClientService.removeFile('/' + this.driveId + (path.startsWith('/') ? path : '/' + path));
      this.$refs.contextMenu.close();
      await this.fetchFolder();
    }
  }
};
</script>
