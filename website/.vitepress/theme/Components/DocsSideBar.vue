<script lang="ts" setup>
import { ref, watch } from 'vue'
import {useSidebar} from 'vitepress/theme';
import SideBarGroup from './SideBarGroup.vue';

const { sidebarGroups, hasSidebar } = useSidebar()

const key = ref(0)

watch(
  sidebarGroups,
  () => {
    key.value += 1
  },
  { deep: true }
)
</script>
<template>
  <aside class="xmainbar__sidebar position-fixed-md">
    <SideBarGroup :items="sidebarGroups" :key="key" />
  </aside>
</template>
