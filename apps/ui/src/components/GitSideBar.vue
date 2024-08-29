<template>
  <ul class="nav files-list border-bottom dark">
    <li class="nav-item fs-4">
      <div class="files-list__item">
        <input name="filePath" type="checkbox" value="/" @click="$emit('toggleAll')" :checked="isCheckedAll" />
        &nbsp; Files to commit ({{checkedCount}})
      </div>
    </li>
  </ul>

  <ul class="nav nav-pills flex-column order-0 files-list" v-if="filteredGitChanges.length > 0">
    <GitSideBarRow
      v-for="filteredGitChange in filteredGitChanges"
      :checked="checked"
      :change="filteredGitChange"
      :key="filteredGitChange.path"
      :selectedPath="selectedPathWithoutSlash"
      :data-path="filteredGitChange.path"
      @toggle="$emit('toggle', $event)"
      @selected="$emit('setCurrentDiff', $event)"
      @contextmenu.prevent.stop="showContextMenu($event, filteredGitChange)"
    />
  </ul>
  <div v-else-if="gitChanges === null"><i class="fa-solid fa-rotate fa-spin"></i> Loading...</div>
  <div v-else>No changes to commit</div>

  <ContextMenu ref="contextMenu">
    <template v-slot="slotProps">
      <div class="dropdown" v-if="slotProps.ctx">
        <ul class="dropdown-menu show">
          <li><button class="dropdown-item" type="button" @click="removeFile(slotProps.ctx)"><i class="fa-solid fa-trash"></i> Remove</button></li>
          <li><button class="dropdown-item" type="button" @click="removeFileCached(slotProps.ctx)"><i class="fa-solid fa-trash"></i> Remove from git</button></li>
        </ul>
      </div>
    </template>
  </ContextMenu>
</template>
<script>
import GitSideBarRow from './GitSideBarRow.vue';
import ContextMenu from './ContextMenu.vue';
import {UtilsMixin} from './UtilsMixin.ts';

export default {
  components: {
    ContextMenu,
    GitSideBarRow
  },
  props: {
    gitChanges: Array,
    checked: Object,
    selectedPath: String
  },
  mixins: [ UtilsMixin ],
  data() {
    return {
      tree: [],
      checkedDirs: {}
    };
  },
  emits: ['toggle', 'toggleAll', 'collapse', 'setCurrentDiff'],
  watch: {
    gitChanges() {
      const retVal = [];
      for (const change of this.filteredGitChanges) {
        const parts = change.path.split('/');

        let currentArr = retVal;
        let currentPath = '';
        for (const part of parts) {
          currentPath += '/' + part;
          const node = currentArr.find(item => item.fileName === part);
          if (node) {
            currentArr = node.children;
          } else {
            const newNode = {
              fileName: part,
              children: [],
              path: currentPath.substring(1)
            };

            if (change.path === newNode.path) {
              newNode.change = change;
              if (change.state.isDeleted) {
                newNode.status = 'D';
              }
              if (change.state.isNew) {
                newNode.status = 'N';
              }
              if (change.state.isModified) {
                newNode.status = 'M';
              }
              if (change.state.isRenamed) {
                newNode.status = 'R';
              }
            }

            currentArr.push(newNode);
            currentArr = newNode.children;
          }
        }
      }
      this.tree = retVal;

      this.checkedDirs = {};
      this.addCheckedDirs(this.tree);
    },
    checked: {
      deep: true,
      handler() {
        this.checkedDirs = {};
        this.addCheckedDirs(this.tree);
      }
    }
  },
  methods: {
    async removeFile(file) {
      if (!window.confirm('Are you sure?')) {
        this.$refs.contextMenu.close();
        return;
      }
      const path = file.path;
      await this.FileClientService.removeFile('/' + this.driveId + (path.startsWith('/') ? path : '/' + path));
      this.$refs.contextMenu.close();
    },
    async removeFileCached(file) {
      if (!window.confirm('Are you sure?')) {
        this.$refs.contextMenu.close();
        return;
      }
      const filePath = file.path;
      await this.authenticatedClient.fetchApi(`/api/git/${this.driveId}/remove_cached`, {
        method: 'post',
        headers: {
          'Content-type': 'application/json'
        },
        body: JSON.stringify({ filePath })
      });
      this.$refs.contextMenu.close();
    },
    showContextMenu(event, ctx) {
      this.$refs.contextMenu.open(event, ctx);
    },
    addCheckedDirs(tree) {
      for (const item of tree) {
        if (item.children.length > 0) {
          this.addCheckedDirs(item.children);
          const dirChanges = this.gitChanges.filter(change => change.path.startsWith(item.path + '/'));
          let checkedCount = 0;
          for (const dirChange of dirChanges) {
            if (this.checked[dirChange.path]) {
              checkedCount++;
            }
          }
          if (dirChanges.length === checkedCount) {
            this.checkedDirs[item.path] = true;
          }
        }
      }
    },
    toggleDir(path) {
      if (this.checkedDirs[path]) {
        const dirChanges = this.gitChanges.filter(change => change.path.startsWith(path + '/'));
        for (const dirChange of dirChanges) {
          if (this.checked[dirChange.path]) {
            this.$emit('toggle', dirChange.path);
          }
        }
      } else {
        const dirChanges = this.gitChanges.filter(change => change.path.startsWith(path + '/'));
        for (const dirChange of dirChanges) {
          if (!this.checked[dirChange.path]) {
            this.$emit('toggle', dirChange.path);
          }
        }
      }
    }
  },
  computed: {
    selectedPathWithoutSlash() {
      return this.selectedPath.replace(/^\//, '');
    },
    filteredGitChanges() {
      if (null === this.gitChanges) {
        return [];
      }
      return this.gitChanges.filter(change => {
        return (change.path.indexOf('.assets/') === -1);
      });
    },
    checkedCount() {
      return Object.keys(this.checked).length;
    },
    isCheckedAll() {
      return Object.keys(this.checked).length === this.gitChanges?.length;
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
          if (this.selectedPath) {
            this.$emit('collapse', true);
          }
        }
      }

    }, true);
  }
};
</script>
