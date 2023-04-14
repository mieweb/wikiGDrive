<template>
  <div class="card">
    <slot name="header"></slot>
    <div class="card-body">
      <slot></slot>
      <button v-if="git_remote_url" type="button" class="btn btn-danger" @click="push"><i v-if="active_jobs.length > 0" class="fa-solid fa-rotate fa-spin"></i> Push</button>
      <button v-if="git_remote_url" type="button" class="btn btn-secondary" @click="pull"><i v-if="active_jobs.length > 0" class="fa-solid fa-rotate fa-spin"></i> Pull</button>
      <span v-if="!git_remote_url">
        No git remote, go to <router-link :to="{ name: 'drive', params: { driveId }, hash: '#git_settings' }">settings</router-link>
      </span>
    </div>
  </div>
</template>
<script>
import {disableElement, UtilsMixin} from './UtilsMixin.ts';
import {GitMixin} from './GitMixin.ts';

export default {
  mixins: [UtilsMixin, GitMixin],
  props: {
    checked: {
      type: Object,
      default: () => ({})
    }
  },
  computed: {
    git_remote_url() {
      return this.gitStats.remote_url || '';
    }
  },
  methods: {
    async pull(event) {
      await disableElement(event, async () => {
        await this.authenticatedClient.fetchApi(`/api/git/${this.driveId}/pull`, {
          method: 'post',
          headers: {
            'Content-type': 'application/json'
          },
          body: JSON.stringify({})
        });
      });
    },
    async push(event) {
      const checkedFileNames = Object.keys(this.checked);
      if (checkedFileNames.length > 0) {
        await this.$parent.submitCommit();
      }

      await disableElement(event, async () => {
        await this.authenticatedClient.fetchApi(`/api/git/${this.driveId}/push`, {
          method: 'post',
          headers: {
            'Content-type': 'application/json'
          },
          body: JSON.stringify({})
        });
      });
    }
  }
};
</script>
