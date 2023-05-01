<template>
  <div class="container mainbar__content-height" v-if="user_config">
    <StatusToolBar :active-tab="activeTab" />

    <div class="card flex-grow-1 flex-shrink-1 overflow-scroll">
      <div class="card-body">
        <form>
          <div class="form-group">
            <label>Config.toml for preview</label>
            <CodeEditor v-model="user_config.actions_yaml" lang="yaml" />
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
  name: 'WorkflowsEditor',
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
    }
  },
  methods: {
    async processResponse(json) {
      this.user_config = json.config || {};
      this.remote_url = json.remote_url;
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
    }
  }
};
</script>
