<template>
  <div class="container" v-if="user_config">
    <div class="card">
      <div class="card-body">
        <form>
          <div class="form-group">
            <label>
              Remote URL
            </label>
            <input class="form-control" size="50" placeholder="git@github.com:[...].git" v-model="user_config.remote_url" />
          </div>
          <div class="form-group">
            <label>
              Remote Branch
            </label>
            <input class="form-control" size="50" placeholder="remote_branch, eg: gh-pages" v-model="user_config.remote_branch" />
          </div>
          <div class="form-group">
            <label>Theme</label>
            <select class="form-control" @change="changeTheme($event.target.value)">
              <option></option>
              <option
                  :selected="userThemeId === theme.id"
                  :value="theme.id"
                  :key="theme.id"
                  v-for="theme of drive.hugo_themes">{{ theme.name }}</option>
            </select>
          </div>

          <div v-if="userThemeId">
            <img v-if="user_config.hugo_theme.preview_img" :src="user_config.hugo_theme.preview_img" style="height: 250px;" :alt="user_config.hugo_theme.id" />
          </div>

          <div class="form-group">
            <label>Content subdirectory</label>
            <input class="form-control" rows="10" v-model="user_config.transform_subdir" />
          </div>

          <div class="form-group">
            <label>Config.toml</label>
            <textarea class="form-control" rows="10" v-model="user_config.config_toml"></textarea>
          </div>

          <button class="btn btn-primary" type="button" @click="save">Save</button>

        </form>
      </div>
    </div>

    <div v-if="gitInitialized && github_url" class="mt-3">
      <div class="card">
        <div class="card-body">
          <div v-if="github_url">
            To allow repo push copy below ssh key into GitHub repo -> Settings -> <a :href="github_url + '/settings/keys'" target="_blank">Deploy keys</a>.<br />
            Then check <code>Allow write access</code>
          </div>
          <div class="input-group">
            <textarea class="form-control" rows="10" placeholder="Deploy key" readonly :value="public_key" @click="copyEmail"></textarea>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<script>
import {UtilsMixin} from './UtilsMixin.mjs';

export default {
  mixins: [UtilsMixin],
  data() {
    return {
      user_config: null
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
    drive() {
      return this.$root.drive || {};
    },
    public_key() {
      return this.$root.drive?.git?.public_key || '';
    },
    userThemeId() {
      return this.user_config?.hugo_theme?.id || '';
    }
  },
  methods: {
    async fetch() {
      const response = await this.authenticatedClient.fetchApi(`/api/config/${this.driveId}`);
      this.user_config = await response.json();
    },
    async save() {
      const response = await this.authenticatedClient.fetchApi(`/api/config/${this.driveId}`, {
        method: 'put',
        headers: {
          'Content-type': 'application/json'
        },
        body: JSON.stringify(this.user_config)
      });
      this.user_config = await response.json();
      alert('Saved');
    },
    changeTheme(themeId) {
      if (!themeId) {
        this.user_config.hugo_theme = {};
      }
      this.user_config.hugo_theme = this.drive.hugo_themes.find(t => t.id === themeId) || {};
    }
  }
};
</script>
