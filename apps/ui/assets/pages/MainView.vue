<template>
  <BaseLayout>
    <template v-slot:default>
      <div class="container">
        <form @submit.prevent.stop="submit">
          <legend>Share</legend>
          <div class="input-group">
            <input class="form-control" v-model="url" placeholder="https://drive.google.com/drive/u/0/folders/..." />
            <button type="submit" class="btn btn-primary">Share</button>
          </div>
        </form>

        <div class="mt-3">
          or select one of your <a href="/drive">drives</a>
        </div>

      </div>
    </template>
  </BaseLayout>
</template>
<script>
import BaseLayout from '../layout/BaseLayout.vue';

export default {
  components: {
    BaseLayout
  },
  data() {
    return {
      url: ''
    };
  },
  methods: {
    async submit() {
      const response = await fetch('/api/share_drive', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: this.url
        })
      });
      const json = await response.json();
      if (json.driveId) {
        await this.$router.push({ name: 'drive', params: { driveId: json.driveId } });
      } else {
        alert('Error sharing drive');
      }
    }
  }
};
</script>
