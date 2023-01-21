<template>
  <div v-if="isHtml && content" v-html="content"></div>
  <div v-else-if="!loading">
    <div class="container">
      404 NOT FOUND
    </div>
  </div>
</template>
<script>

export default {
  data() {
    return {
      loading: false,
      content: ''
    };
  },
  created() {
    this.fetch();
  },
  watch: {
    $route() {
      this.fetch();
    }
  },
  computed: {
    isHtml() {
      return (this.$route.path.endsWith('.html') || this.$route.path === '/');
    }
  },
  methods: {
    async fetch() {
      this.loading = true;
      try {
        const response = await fetch(['/', '/driveui'].includes(this.$route.path) ? '/index.html' : this.$route.path);
        if (response.status < 300) {
          let innerHTML = await response.text();
          if (innerHTML.indexOf('<body') > -1) {
            innerHTML = innerHTML.substring(innerHTML.indexOf('<body'));
          }

          let div = document.createElement('div');
          div.innerHTML = innerHTML;
          if (div.querySelector('#app')) {
            div = div.querySelector('#app');
          }
          this.content = div.innerHTML;
        }
      } finally {
        this.loading = false;
      }
    }
  }
};
</script>
