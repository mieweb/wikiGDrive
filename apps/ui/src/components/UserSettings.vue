<template>
  <div class="container mainbar__content-height" v-if="user_config">
    <StatusToolBar :active-tab="activeTab" />

    <div class="card flex-grow-1 flex-shrink-1 overflow-scroll" v-if="activeTab === 'drive_config'">
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
            <label>Autosync</label>
            <select class="form-control" @change="user_config.auto_sync = !user_config.auto_sync">
              <option :selected="!user_config.auto_sync" value="">Disabled</option>
              <option :selected="user_config.auto_sync" value="enabled">Enabled</option>
            </select>
          </div>

          <div class="form-group">
            <label>Frontmatter without version and date</label>
            <select class="form-control" @change="user_config.fm_without_version = !user_config.fm_without_version">
              <option :selected="!user_config.fm_without_version" value="">Disabled</option>
              <option :selected="user_config.fm_without_version" value="enabled">Enabled</option>
            </select>
          </div>

          <div class="form-group">
            <label>Config.toml for preview</label>
            <CodeEditor v-model="user_config.config_toml" lang="toml" />
          </div>
        </form>
      </div>
    </div>

    <div>
      <br/>
      <button class="btn btn-primary" type="button" @click="save">Save</button>
    </div>
  </div>
</template>
<script>
import {UtilsMixin} from './UtilsMixin.ts';
import StatusToolBar from './StatusToolBar.vue';
import CodeEditor from './CodeEditor.vue';

export default {
  mixins: [UtilsMixin],
  components: {
    StatusToolBar, CodeEditor
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
    async nukeContentDir() {
      if (!window.confirm('Are you sure you want to remove everything?')) {
        return;
      }

      await this.authenticatedClient.fetchApi(`/api/config/${this.driveId}/prune_transform`, {
        method: 'post'
      });

      window.location.reload();
    }
  }
};
</script>
