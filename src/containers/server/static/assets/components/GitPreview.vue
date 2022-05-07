<template>
  <div class="mui-container">
      <br/>
      <div class="mui-panel">
        <form>
          <div class="mui-textfield">
            <textarea placeholder="Commit message" v-model="message"></textarea>
          </div>
          <button type="button" class="mui-btn mui-btn--primary" @click="commit">Commit</button>
          <button v-if="git_remote_url" type="button" class="mui-btn mui-btn--danger" @click="$emit('push')">Push</button>
        </form>
      </div>
      <table class="mui-table mui-table--bordered" v-if="git.history && git.history.length > 0">
        <thead>
          <tr>
            <th>Date</th>
            <th>Author</th>
            <th>Message</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, idx) of git.history" :key="idx">
            <td>{{item.date}}</td>
            <td>{{item.author_name}}</td>
            <td>{{item.message}}</td>
          </tr>
        </tbody>
      </table>
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
      message: ''
    };
  },
  computed: {
    git_remote_url() {
      return this.git?.remote_url || '';
    }
  },
  methods: {
    open(url) {
      window.open(url, '_blank');
    },
    commit() {
      if (!this.message) {
        alert('No commit message');
        return;
      }
      this.$emit('commit', {
        message: this.message
      });
    }
  }
};
</script>
