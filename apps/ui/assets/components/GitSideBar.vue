<template>
  <ul class="nav files-list border-bottom dark">
    <li class="nav-item fs-4">
      <div class="files-list__item">
        <i class="fa-brands fa-github"></i>&nbsp; Files to commit
      </div>
    </li>
  </ul>

  <GitSideBarLeaf
      v-if="gitChanges && gitChanges.length > 0"
      :tree="tree"
      :checked="checked"
      :checkedDirs="checkedDirs"
      :selectedPath="selectedPath"
      @toggleDir="toggleDir"
      @toggle="$emit('toggle', $event)"
      @selected="$emit('setCurrentDiff', $event)"
  />
  <div v-else-if="gitChanges === null"><i class="fa-solid fa-rotate fa-spin"></i> Loading...</div>
  <div v-else>No changes to commit</div>
</template>
<script>
import GitSideBarLeaf from './GitSideBarLeaf.vue';

export default {
  components: {
    GitSideBarLeaf
  },
  props: {
    gitChanges: Array,
    checked: Object,
    selectedPath: String
  },
  data() {
    return {
      tree: [],
      checkedDirs: {}
    };
  },
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

            if (change.path === currentPath) {
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
    filteredGitChanges() {
      return this.gitChanges.filter(change => {
        return (change.path.indexOf('.assets/') === -1);
      });
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
