<script setup lang="ts">
import type { DefaultTheme } from 'vitepress/theme'
import {computed, onMounted, ref} from 'vue';
import {useData} from 'vitepress';

const { page, hash } = useData()

const HASH_OR_QUERY_RE = /[?#].*$/
const INDEX_OR_EXT_RE = /(?:(^|\/)index)?\.(?:md|html)$/

function normalize(path: string): string {
  return decodeURI(path)
    .replace(HASH_OR_QUERY_RE, '')
    .replace(INDEX_OR_EXT_RE, '$1')
}

function isActive(
  currentPath: string,
  matchPath?: string,
  asRegex: boolean = false
): boolean {
  if (matchPath === undefined) {
    return false
  }
  matchPath = '/docs' + matchPath;

  currentPath = normalize(`/${currentPath}`)

  if (asRegex) {
    return new RegExp(matchPath).test(currentPath)
  }

  if (normalize(matchPath) !== currentPath) {
    return false
  }

  // const hashMatch = matchPath.match(HASH_RE)

  // if (hashMatch) {
  //   return (inBrowser ? location.hash : '') === hashMatch[0]
  // }

  return true
}

const props = defineProps<{
  item: DefaultTheme.SidebarItem
  depth: number
}>();

const isActiveLink = ref(false)
const updateIsActiveLink = () => {
  isActiveLink.value = isActive(page.value.relativePath, props.item.link);
}
onMounted(updateIsActiveLink);

const itemLink = computed(() => (props.item.link ? '/docs' + props.item.link : '/docs'));
</script>
<template>
  <li>
    <div class="nav-item xfiles-list__item" style="padding-left: 8px;">
      <a class="nav-link" :class="{active: isActiveLink}" :href="itemLink">{{ item.text }}</a>
      <div v-if="item.items && item.items.length" class="items">
        <template v-if="depth < 5">
          <ul class="nav nav-pills flex-column order-0 xfiles-list">
            <SideBarItem
              v-for="i in item.items"
              :key="i.text"
              :item="i"
              :depth="depth + 1"
            />
          </ul>
        </template>
      </div>
    </div>
  </li>
</template>
