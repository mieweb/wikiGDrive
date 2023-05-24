<template>
  <div class="container" v-if="user_config">
    <slot name="toolbar">
      <GitToolBar :active-tab="activeTab" />
    </slot>

    <div class="overflow-scroll d-flex flex-row mt-3">
      <slot name="sidebar">
        <SettingsSidebar />
      </slot>

      <div class="card flex-column order-0 flex-grow-1 flex-shrink-1 overflow-scroll border-left-0-not-first">
        <slot name="header">
<!--          <div class="card-header">Git</div>-->
        </slot>
        <div class="card-body">
          <div class="form-group">
            <label>
              Remote URL
            </label>
            <input class="form-control" size="50" placeholder="git@github.com:[...].git" v-model="remote_url" />
          </div>
          <div class="form-group">
            <label>
              Remote Branch
            </label>
            <input class="form-control" size="50" placeholder="remote_branch, eg: gh-pages" v-model="user_config.remote_branch" />
          </div>

          <div v-if="github_url">
            To allow repo push copy below ssh key into GitHub repo -> Settings -> <a :href="github_url + '/settings/keys'" target="_blank">Deploy keys</a>.<br />
            Then check <code>Allow write access</code>
          </div>
          <div v-if="public_key" class="mt-3">
            <div class="form-group">
              <label>Deploy key id_rsa.pub</label>
              <textarea class="form-control" rows="6" placeholder="Deploy key" readonly :value="public_key" @click="copyEmail"></textarea>
            </div>
          </div>
        </div>
        <div class="card-footer">
          <div class="btn-group">
            <button class="btn btn-primary" type="button" @click="save">Save</button>
            <button v-if="remote_url && treeEmpty" class="btn btn-secondary" type="button" @click="saveAndReset">Save and reset to remote</button>
          </div>
          <button class="btn btn-danger float-end" type="button" @click="regenerateKey">Regenerate</button>
        </div>
      </div>
    </div>
  </div>
</template>
<script>
import {UtilsMixin} from './UtilsMixin.ts';
import GitToolBar from './GitToolBar.vue';
import {DangerMixin} from './DangerMixin.ts';
import SettingsSidebar from './SettingsSidebar.vue';

export default {
  mixins: [UtilsMixin, DangerMixin],
  components: {
    GitToolBar, SettingsSidebar
  },
  props: {
    activeTab: {
      type: String
    },
    treeEmpty: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      user_config: null,
      remote_url: '',
      public_key: ''
    };
  },
  async created() {
    await this.fetch();
  },
  watch: {
    async $route() {
      await this.fetch();
    }
  },
  computed: {
    github_url() {
        const remote_url = this.remote_url || '';
        if (remote_url.startsWith('git@github.com:')) {
            return remote_url.replace('git@github.com:', 'https://github.com/')
                .replace(/.git$/, '');
        }
        return '';
    },
    drive() {
      return this.$root.drive || {};
    }
  },
  methods: {
    async processResponse(json) {
      this.user_config = json.config || {};
      this.remote_url = json.remote_url;
      this.public_key = json.public_key;
    },
    async fetch() {
      const response = await this.authenticatedClient.fetchApi(`/api/config/${this.driveId}`);
      const json = await response.json();
      await this.processResponse(json);
    },
    async save() {
      const response = await this.authenticatedClient.fetchApi(`/api/config/${this.driveId}`, {
        method: 'put',
        headers: {
          'Content-type': 'application/json'
        },
        body: JSON.stringify({
          config: this.user_config,
          remote_url: this.remote_url
        })
      });
      const json = await response.json();
      await this.processResponse(json);
      await this.$root.changeDrive(this.driveId);
    },
    async saveAndReset() {
      await this.save();
      await this.resetToRemote();
    },
    async regenerateKey() {
      if (!window.confirm('Are you sure you want to regenerate deploy key?')) {
        return;
      }

      const response = await this.authenticatedClient.fetchApi(`/api/config/${this.driveId}/regenerate_key`, {
        method: 'post'
      });

      const json = await response.json();
      await this.processResponse(json);
    }
  }
};
</script>
