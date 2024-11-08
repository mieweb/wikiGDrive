<script setup lang="ts">
import {onContentUpdated, useData} from 'vitepress';
import { ref, shallowRef } from 'vue'

const { frontmatter, theme } = useData()

export interface Header {
  /**
   * The level of the header
   *
   * `1` to `6` for `<h1>` to `<h6>`
   */
  level: number
  /**
   * The title of the header
   */
  title: string
  /**
   * The slug of the header
   *
   * Typically the `id` attr of the header anchor
   */
  slug: string
  /**
   * Link of the header
   *
   * Typically using `#${slug}` as the anchor hash
   */
  link: string
  /**
   * The children of the header
   */
  children: Header[]
}

export type MenuItem = Omit<Header, 'slug' | 'children'> & {
  element: HTMLHeadElement
  children?: MenuItem[]
}

const headers = shallowRef<MenuItem[]>([])

function serializeHeader(h: Element): string {
  let ret = ''
  for (const node of h.childNodes) {
    if (node.nodeType === 1) {
      if (
        (node as Element).classList.contains('VPBadge') ||
        (node as Element).classList.contains('header-anchor') ||
        (node as Element).classList.contains('ignore-header')
      ) {
        continue
      }
      ret += node.textContent
    } else if (node.nodeType === 3) {
      ret += node.textContent
    }
  }
  return ret.trim()
}

function getHeaders(): MenuItem[] {
  const headers = [
    ...document.querySelectorAll('#md_rendered :where(h1,h2,h3,h4,h5,h6)')
  ]
    .filter((el) => el.id && el.hasChildNodes())
    .map((el) => {
      const level = Number(el.tagName[1])
      return {
        element: el as HTMLHeadElement,
        title: serializeHeader(el),
        link: '#' + el.id,
        level
      }
    })
    .filter( header => header.level > 1 && header.level < 3);
  return headers;
}

onContentUpdated(() => {
  headers.value = getHeaders()
})

const container = ref()
const marker = ref()

//useActiveAnchor(container, marker)
</script>

<template>
  <aside class="toc-aside position-fixed-md">
    <h4>Table of Contents</h4>
    <nav id="TableOfContents">
      <ul>
        <li v-for="(header, idx) in headers" :key="idx"><a :href="header.link">{{ header.title }}</a></li>
      </ul>
    </nav>
  </aside>
</template>
