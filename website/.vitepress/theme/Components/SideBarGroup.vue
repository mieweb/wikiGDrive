<script setup lang="ts">
import type { DefaultTheme } from 'vitepress/theme'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import SideBarItem from './SideBarItem.vue'

defineProps<{
  items: DefaultTheme.SidebarItem[]
}>()

const disableTransition = ref(true)

let timer: ReturnType<typeof setTimeout> | null = null

onMounted(() => {
  timer = setTimeout(() => {
    timer = null
    disableTransition.value = false
  }, 300)
})

onBeforeUnmount(() => {
  if (timer != null) {
    clearTimeout(timer)
    timer = null
  }
})
</script>

<template>
  <ul class="nav nav-pills flex-column order-0 xfiles-list"
    v-for="item in items"
    :key="item.text"
    :class="{ 'no-transition': disableTransition }"
  >
    <SideBarItem :item="item" :depth="0" />
  </ul>
</template>
