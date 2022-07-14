<template>
  <div>
    <header class="">
      <!-- Appbar HTML goes here -->
    </header>
    <div class="container">
      <form @submit.prevent.stop="submit">
        <legend>Share</legend>
        <div class="input-group">
          <input class="form-control" v-model="url" placeholder="https://drive.google.com/drive/u/0/folders/..." />
        </div>
        <button type="submit" class="btn btn-primary">Share</button>
      </form>
    </div>
  </div>
</template>
<script>
export default {
  data() {
    return {
      url: ''
    };
  },
  methods: {
    async submit() {
      console.log(this.url);
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
      await this.$router.push({ name: 'drive', params: { driveId: json.drive_id } });
    }
  }
};
</script>
