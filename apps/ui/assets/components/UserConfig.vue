<template>
  <div class="container" v-if="user_config">
    <div class="row py-1">
      <div class="col-12 text-end">
        <ToolButton
            :active="activeTab === 'drive_config'"
            @click="setActiveTab('drive_config')"
            title="Generation"
            icon="fa-brands fa-markdown me-1"
        />

        <ToolButton
            :active="activeTab === 'drive_config_git'"
            @click="setActiveTab('drive_config_git')"
            title="Git"
            icon="fa-brands fa-github"
        />
      </div>
    </div>


    <div class="card" v-if="activeTab === 'drive_config'">
      <div class="card-body">
        <form>
          <div class="form-group">
            <label>Theme</label>
            <select class="form-control" @change="changeTheme($event.target.value)">
              <option value="">Without theme - use repo theme</option>
              <option
                  :selected="userThemeId === theme.id"
                  :value="theme.id"
                  :key="theme.id"
                  v-for="theme of hugo_themes">{{ theme.name }}</option>
            </select>
          </div>

          <div v-if="userThemeId">
            <img v-if="user_config.hugo_theme.preview_img" :src="user_config.hugo_theme.preview_img" style="height: 250px;" :alt="user_config.hugo_theme.id" />
          </div>

          <div class="form-group">
            <label>Content subdirectory</label>
            <input class="form-control" rows="10" v-model="user_config.transform_subdir" />
          </div>
          <button class="btn btn-danger" type="button" @click="nukeContentDir()"><i class="fa-solid fa-explosion"></i> Nuke markdown directory</button>

          <div class="form-group">
            <label>Config.toml for preview</label>
            <textarea class="form-control" rows="10" v-model="user_config.config_toml"></textarea>
          </div>
        </form>
      </div>
    </div>

    <div class="card" v-if="activeTab === 'drive_config_git'">
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

        <button class="btn btn-danger" type="button" @click="nukeGitDir()"><i class="fa-solid fa-explosion"></i> Nuke .git directory</button>

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
        <button class="btn btn-danger" type="button" @click="regenerateKey">Regenerate</button>
      </div>
    </div>
    <br/>
    <button class="btn btn-primary" type="button" @click="save">Save</button>
  </div>
</template>
<script>
import {UtilsMixin} from './UtilsMixin.mjs';
import ToolButton from './ToolButton.vue';

export default {
  mixins: [UtilsMixin],
  components: {
    ToolButton
  },
  props: {
    activeTab: {
      type: String
    }
  },
  data() {
    return {
      user_config: null,
      remote_url: '',
      public_key: '',
      hugo_themes: []
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
    userThemeId() {
      return this.user_config?.hugo_theme?.id || '';
    }
  },
  methods: {
    async processResponse(json) {
      this.user_config = json.config || {};
      this.remote_url = json.remote_url;
      this.public_key = json.public_key;
      this.hugo_themes = json.hugo_themes;
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
      alert('Saved');
    },
    changeTheme(themeId) {
      if (!themeId) {
        this.user_config.hugo_theme = {};
      }
      this.user_config.hugo_theme = this.hugo_themes.find(t => t.id === themeId) || {};
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
    },
    async nukeContentDir() {
      if (!window.confirm('Are you sure you want to remove everything?')) {
        return;
      }

      await this.authenticatedClient.fetchApi(`/api/config/${this.driveId}/prune_transform`, {
        method: 'post'
      });

      window.location.reload();
    },
    async nukeGitDir() {
      if (!window.confirm('Are you sure you want to remove .git directory?')) {
        return;
      }

      await this.authenticatedClient.fetchApi(`/api/config/${this.driveId}/prune_git`, {
        method: 'post'
      });

      window.location.reload();
    }
  }
};
</script>
