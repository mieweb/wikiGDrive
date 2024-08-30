<template>
  <div class="container mainbar__content-height" v-if="drive_config">
    <slot name="toolbar">
      <StatusToolBar :active-tab="activeTab" />
    </slot>

    <div class="overflow-scroll d-flex flex-row mt-3">
      <slot name="sidebar">
        <SettingsSidebar />
      </slot>

      <div class="card flex-grow-1 flex-shrink-1 overflow-scroll border-left-0-not-first">
        <slot name="header">
        </slot>
        <div class="card-body" v-id="user_config">
          <form>
            <div class="form-group">
              <label :class="!user_config.transform_subdir ? 'text-danger' : ''">Content subdirectory</label>
              <input class="form-control" rows="10" v-model="user_config.transform_subdir" />
            </div>

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
              <label>Use Google Markdowns</label>
              <select class="form-control" @change="user_config.use_google_markdowns = !user_config.use_google_markdowns">
                <option :selected="!user_config.use_google_markdowns" value="">Disabled</option>
                <option :selected="user_config.use_google_markdowns" value="enabled">Enabled</option>
              </select>
            </div>

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

            <div class="form-group">
              <label>Markdown Links Rewrite Rules</label>
              <CodeEditor v-model="user_config.rewrite_rules_yaml" lang="yaml" />
            </div>
          </form>
          <br/>
          <button class="btn btn-primary" type="button" @click="save">Save</button>
        </div>
      </div>
    </div>
  </div>
</template>
<script>
import {UtilsMixin} from './UtilsMixin.ts';
import {DangerMixin} from './DangerMixin.ts';
import StatusToolBar from './StatusToolBar.vue';
import CodeEditor from './CodeEditor.vue';
import SettingsSidebar from './SettingsSidebar.vue';

export default {
  mixins: [UtilsMixin, DangerMixin],
  components: {
    StatusToolBar, CodeEditor, SettingsSidebar
  },
  props: {
    activeTab: {
      type: String
    },
    drive_config: {},
    remote_url: {}
  },
  computed: {
    user_config() {
      return this.drive_config?.config || {};
    },
    hugo_themes() {
      return this.drive_config?.hugo_themes || [];
    },
    drive() {
      return this.$root.drive || {};
    },
    userThemeId() {
      return this.drive_config?.user_config?.hugo_theme?.id || '';
    }
  },
  methods: {
    async save() {
      const response = await this.authenticatedClient.fetchApi(`/api/config/${this.driveId}`, {
        method: 'put',
        headers: {
          'Content-type': 'application/json'
        },
        body: JSON.stringify({
          config: this.drive_config.config,
          remote_url: this.drive_config.remote_url
        })
      });
      alert('Saved');
      this.$emit('changed');
    },
    changeTheme(themeId) {
      if (!themeId) {
        this.drive_config.config.hugo_theme = {};
      }
      this.drive_config.config.hugo_theme = this.hugo_themes.find(t => t.id === themeId) || {};
    }
  }
};
</script>
