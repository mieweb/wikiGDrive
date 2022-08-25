<template>
  <GitSideBarLeaf
      v-if="gitChanges !== null"
      :tree="tree"
      :checked="checked"
      :selectedPath="selectedPath"
      @selected="$emit('setCurrentDiff', $event)"
  />
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
  computed: {
    filteredGitChanges() {
      return this.gitChanges.filter(change => {
        return (change.path.indexOf('.assets/') === -1);
      });
    },
    tree() {
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
      return retVal;
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
