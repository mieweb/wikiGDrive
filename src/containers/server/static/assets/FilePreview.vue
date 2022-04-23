<template>
  <div>
    <ul class="mui-tabs__bar">
      <li :class="{ 'mui--is-active': activeTab === 'markdown' }"><a @click.prevent.stop="setActiveTab('markdown')" data-mui-toggle="tab">Preview</a></li>
      <li :class="{ 'mui--is-active': activeTab === 'git' }"><a @click.prevent.stop="setActiveTab('git')" data-mui-toggle="tab">Git</a></li>
      <button v-if="hasSync" type="button" @click="$emit('sync')" class="mui-btn mui-btn--small mui--pull-right"><i class="fa-solid fa-rotate" :class="{'fa-spin': preview.syncing}"></i> Sync</button>
    </ul>

    <div v-if="activeTab === 'markdown' && preview.mimeType === 'text/x-markdown'">
      <MarkDown>{{preview.content}}</MarkDown>
    </div>

    <GitPreview v-if="activeTab === 'git'" :git="git" @setup="$emit('setup', $event)" @commit="$emit('commit', $event)" @push="$emit('push', $event)" />

  </div>
</template>
<script>
import {UtilsMixin} from './UtilsMixin.mjs';
import MarkDown from './MarkDown.vue';
import GitPreview from './GitPreview.vue';

export default {
  name: 'FilePreview',
  mixins: [UtilsMixin],
  components: {
    GitPreview,
    MarkDown,
  },
  props: {
    activeTab: {
      type: String
    },
    hasSync: {
      type: Boolean,
      default: false
    },
    preview: Object,
    git: Object
  },
  methods: {
    setActiveTab(tab) {
      this.$router.replace({ hash: '#' + tab });
    }
  }
};
</script>
