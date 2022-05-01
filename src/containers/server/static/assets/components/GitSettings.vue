<template>
  <div class="mui-container">
    <div class="mui-panel">
      <form>
        <div class="mui-textfield">
          <input size="50" placeholder="git@github.com:[...].git" v-model="remote_url" />
        </div>
        <div class="mui-textfield">
          <input size="50" placeholder="remote_branch, eg: gh-pages" v-model="remote_branch" />
        </div>

        <button class="mui-btn mui-btn--primary" type="button" @click="setup">Save</button>

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
      remote_url: '',
      remote_branch: ''
    };
  },
  watch: {
    git() {
      this.remote_url = this.git?.remote_url || '';
      this.remote_branch = this.git?.remote_branch || '';
    }
  },
  methods: {
    setup() {
      this.$emit('setup', {
        remote_url: this.remote_url,
        remote_branch: this.remote_branch
      });
    },
  }
};
</script>
