<template>
  <CodeEditor :model-value="value" lang="markdown" readonly :room-id="'markdown_' + absPath" />
</template>
<script lang="ts">

import CodeEditor from './CodeEditor.vue';

export default {
  components: {CodeEditor},
  props: ['absPath', 'value'],
  mounted() {
    const absPath = this.absPath.endsWith('/') ? this.absPath.substring(0, this.absPath.length - 1) : this.absPath;
/*
    const links = this.$refs.code.querySelectorAll('a[data-to-rewrite]');
    for (const link of links) {
      const href = link.getAttribute('href');
      if (href.startsWith('#')) {
        link.removeAttribute('href');
      } else
      if (href.endsWith('.md')) {
        link.setAttribute('href', absPath + '/' + href + '#markdown');
        link.addEventListener('click', event => {
          event.preventDefault();
          this.$router.push(link.getAttribute('href'));
        });
      } else
      if (href.endsWith('.svg')) {
        link.setAttribute('href', absPath + '/' + href);
        link.addEventListener('click', event => {
          event.preventDefault();
          this.$router.push(link.getAttribute('href'));
        });
      }
      link.removeAttribute('data-to-rewrite');
    }
*/
  }
};
</script>
