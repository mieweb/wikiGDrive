<template>
  <div class="table-responsive">
    <form @submit.prevent.stop="submit">
      Share
      <input v-model="url" />
      <button type="submit">Share</button>
    </form>
  </div>
</template>
<script>
export default {
  data() {
    return {
      url: ''
    }
  },
  created() {
    console.log('ccc');
  },
  methods: {
    async submit() {
      console.log(this.url);
      await fetch('/api/test', {
        method: 'POST',
        data: {
          url: this.url
        }
      });
    }
  }
}
</script>
