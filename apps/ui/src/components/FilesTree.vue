<template>
  <ul class="nav files-list border-bottom dark">
    <li class="nav-item fs-4" v-if="drive.id">
      <div class="files-list__item">
        <i class="fa-brands fa-google-drive"></i>&nbsp;
        <a :href="'/drive/' + drive.id + ''">{{ drive.name }}</a>
      </div>
    </li>
  </ul>
  <FilesTreeLeaf folderPath="/" v-if="!notRegistered" @selected="$emit('selected', $event)" />
</template>
<script>
import {UtilsMixin} from './UtilsMixin.ts';
import FilesTreeLeaf from './FilesTreeLeaf.vue';

export default {
  mixins: [ UtilsMixin ],
  components: { FilesTreeLeaf },
  props: {
    folderPath: {
      type: String
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
    }
  },
  emits: ['collapse', 'sync'],
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
