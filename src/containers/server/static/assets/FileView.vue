<template>
  <BaseLayout>
    <template v-slot:navbar>
      <div class="mui-tabs">
        <ul class="mui-tabs__bar">
          <li :class="{'mui--is-active': activeTab === 'status'}" @click.prevent.stop="activeTab = 'status'">
            <a href="#">Status</a>
          </li>
          <li v-if="file && file.local" :class="{'mui--is-active': activeTab === 'markdown'}" @click.prevent.stop="activeTab = 'markdown'">
            <a href="#">Markdown</a>
          </li>
          <li v-if="file && file.markdown" :class="{'mui--is-active': activeTab === 'git'}" @click.prevent.stop="activeTab = 'git'">
            <a href="#">Git</a>
          </li>
          <li v-if="file" :class="{'mui--is-active': activeTab === 'debug'}" @click.prevent.stop="activeTab = 'debug'">
            <a href="#">Debug</a>
          </li>
        </ul>
      </div>
    </template>

    <template v-slot:default>
      <div v-if="activeTab === 'status'">
        <table class="mui-table mui-table--bordered" v-if="file">
          <tbody v-if="file.google">
          <tr>
            <th>FileId</th>
            <td>{{file.google.id}}</td>
          </tr>
          <tr>
            <th>Name</th>
            <td>{{file.google.name}}</td>
          </tr>
          <tr>
            <th>Modification</th>
            <td>
              {{file.google.modifiedTime}}
              <span v-if="file.google.lastModifyingUser">
                {{file.google.lastModifyingUser.displayName}}
              </span>
            </td>
          </tr>
          <tr>
            <th>Version</th>
            <td>
              {{file.google.version}}
              <button type="button" class="mui-btn mui-btn--danger" @click="markDirty">Sync</button>
            </td>
          </tr>
          </tbody>

          <tbody v-if="file.local && file.google">
          <tr>
            <th>
              Content downloaded
            </th>
            <td>
              {{file.local.modifiedTime}}
            </td>
          </tr>
          <tr>
            <th>
              Content version
            </th>
            <td>
              {{file.local.version}} <span v-if="file.local.version < file.google.version">Outdated</span>
            </td>
          </tr>
          <tr>
            <th>
              Local Path
            </th>
            <td>
              {{file.local.localPath}}
            </td>
          </tr>
          </tbody>
          <tbody v-else>
          <tr>
            <th>
              Content awaiting download
            </th>
          </tr>
          </tbody>
        </table>
      </div>

      <div v-if="activeTab === 'git'">
        <div v-if="!file.git">Repo not initialized</div>
        <div v-else>
          <table class="mui-table mui-table--bordered" v-if="file">
            <tbody v-if="file.google">
            <tr>
              <th>Status</th>
              <td>{{file.git.status}}</td>
            </tr>
            </tbody>
          </table>
          <form>
            <div class="mui-textfield">
              <textarea placeholder="Commit message"></textarea>
            </div>
            @TODO
            <button type="button" class="mui-btn mui-btn--danger" @click="markDirty">Commit</button>
          </form>
        </div>
      </div>

      <div v-if="activeTab === 'markdown'">
        <form>
          <div class="mui-textfield">
            <MarkDown>{{file.markdown}}</MarkDown>
          </div>
        </form>
      </div>

      <div v-if="activeTab === 'debug'">
        <pre>{{ file }}</pre>
      </div>
    </template>
  </BaseLayout>
</template>
<script lang="ts">
import BaseLayout from './BaseLayout.vue';
import MarkDown from './MarkDown.vue';

export default {
  name: 'FileView',
  components: {
    MarkDown,
    BaseLayout
  },
  data() {
    return {
      activeTab: 'status',
      file: null
    };
  },
  created() {
    this.fetch();
  },
  methods: {
    async fetch() {
      const response = await fetch(`/file/${this.$route.params.id}`);
      const json = await response.json();
      console.log(this.$route.params.id, json);
      this.file = json;
    },
    async markDirty() {
      await fetch(`/file/${this.$route.params.id}/mark_dirty`, {
        method: 'POST'
      });
      await this.fetch();
    }
  }
}
</script>
