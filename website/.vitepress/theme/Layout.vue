<template>
  <slot>
    <BaseLayout class="router-view">
      <template v-slot:default>
        <div v-if="frontmatter.raw_html" class="container mt-3">
          <Content />
        </div>
        <div v-else class="container mt-3">
          <div class="row">
            <div class="col-12 col-md-3 order-2 order-md-0">
              <DocsSideBar />
            </div>
            <div class="col-12 col-md-6 order-1 order-md-0" id="md_rendered">
              <Content />
            </div>
            <div class="col-12 col-md-3" v-if="!page.isNotFound">
              <DocsAside />
            </div>
          </div>
        </div>
      </template>
    </BaseLayout>
  </slot>
</template>
<script setup lang="ts">
import { useData } from 'vitepress'
import DocsSideBar from './Components/DocsSideBar.vue';
import DocsAside from './Components/DocsAside.vue';
import BaseLayout from '@mieweb/wikigdrive-ui/src/layout/BaseLayout.vue';

// https://vitepress.dev/reference/runtime-api#usedata
const { site, frontmatter, page, theme } = useData();
</script>
