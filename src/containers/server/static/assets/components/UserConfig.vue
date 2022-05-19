<template>
  <div class="mui-container">
    <div class="mui-panel">
      <form>
        <div class="mui-textfield">
          <input size="50" placeholder="git@github.com:[...].git" v-model="user_config.remote_url" />
        </div>
        <div class="mui-textfield">
          <input size="50" placeholder="remote_branch, eg: gh-pages" v-model="user_config.remote_branch" />
        </div>
        <div class="mui-textfield">
          <input size="50" placeholder="hugo_theme" v-model="user_config.hugo_theme" />
        </div>

        <button class="mui-btn mui-btn--primary" type="button" @click="save">Save</button>

        <div class="mui-textfield" v-if="git.initialized">
          <textarea rows="10" placeholder="Deploy key" readonly :value="git.public_key" @click="copyEmail"></textarea>
        </div>
      </form>
    </div>
  </div>
</template>
<script>
import {UtilsMixin} from './UtilsMixin.mjs';

export default {
  mixins: [UtilsMixin],
  props: {
    git: Object
  },
  data() {
    return {
      user_config: {
        remote_url: '',
        remote_branch: '',
        hugo_theme: ''
      }
    };
  },
  async created() {
    await this.fetch();
  },
  methods: {
    async fetch() {
      const response = await fetch(`/api/drive/${this.driveId}/user_config`);
      const config = await response.json();
      this.user_config.remote_url = config?.remote_url || '';
      this.user_config.remote_branch = config?.remote_branch || '';
      this.user_config.hugo_theme = config?.hugo_theme || '';
    },
    async save() {
      await fetch(`/api/drive/${this.driveId}/user_config`, {
        method: 'put',
        headers: {
          'Content-type': 'application/json'
        },
        body: JSON.stringify(this.user_config)
      });
    }
  }
};
</script>
