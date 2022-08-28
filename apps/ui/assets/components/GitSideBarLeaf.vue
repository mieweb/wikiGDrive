<template>
  <ul class="nav nav-pills flex-column files-list" v-if="tree.length > 0">
    <li v-for="file in tree" :key="file.path" :title="file.path">
      <div class="nav-item files-list__item"
           :class="{'active': file.path === selectedPath, 'text-git-del': file.status === 'D', 'text-git-new': file.status === 'N', 'text-git-mod': file.status === 'M'}"
           :style="{ 'padding-left': (8 + level * 16) + 'px'}"
           >
        <i class="fa-solid fa-folder" v-if="file.children.length > 0"></i>
        <i v-else class="fa-solid fa-file"></i>
        <span v-if="!file.children.length">
          <input name="filePath" type="checkbox" :value="file.path" @click="$emit('toggle', file.path)" :checked="checked[file.path]" />
        </span>
        <span v-else>
          <input name="filePath" type="checkbox" :value="file.path" @click="$emit('toggleDir', file.path)" :checked="checkedDirs[file.path]" />
        </span>
        <span class="file-name m-1" @click="$emit('selected', '/' + file.path)">{{ file.fileName }}</span>
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
  name: 'GitSideBarLeaf',
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
  methods: {}
};
</script>
