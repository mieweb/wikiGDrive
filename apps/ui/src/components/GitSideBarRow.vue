<template>
  <li :title="change.path">
    <div class="nav-item files-list__item"
         :class="{'active': change.path === selectedPath, 'text-git-del': changeStatus === 'D', 'text-git-new': changeStatus === 'N', 'text-git-mod': changeStatus === 'M'}"
    >
      <span>
        <input name="filePath" type="checkbox" :value="change.path" @click="$emit('toggle', change.path)" :checked="checked[change.path]" />
      </span>
      <span class="file-name m-1" @click="$emit('selected', change)">{{ fileName }} <small v-if="change.attachments > 0">(<i class="fa-solid fa-paperclip"></i>{{ change.attachments }})</small></span>
    </div>
  </li>
</template>
<script>
import {UtilsMixin} from './UtilsMixin.ts';

export default {
  name: 'GitSideBarRow',
  mixins: [ UtilsMixin ],
  props: {
    selectedPath: String,
    change: Object,
    checked: Object
  },
  computed: {
    fileName() {
      const idx = this.change.path.lastIndexOf('/');
      if (idx > -1) {
        return this.change.path.substring(idx + 1);
      }
      return this.change.path;
    },
    changeStatus() {
      if (this.change.state.isDeleted) {
        return 'D';
      }
      if (this.change.state.isNew) {
        return 'N';
      }
      if (this.change.state.isModified) {
        return 'M';
      }
      if (this.change.state.isRenamed) {
        return 'R';
      }
      return '';
    }
  },
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
    }
  }
};
</script>
