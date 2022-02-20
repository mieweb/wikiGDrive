<template>
  <pre><code class="language-markdown line-numbers" ref="code"><slot></slot></code></pre>
</template>
<script lang="ts">
import Prism from './prism.js';
Prism.manual = true;

export default {
  mounted() {
    Prism.highlightElement(this.$refs.code);
  }
}
</script>
