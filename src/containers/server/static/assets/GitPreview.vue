<template>
  <div class="mui-container">
    <div v-if="!git.initialized">
      <br/>
      <div class="mui-panel">
        <h2>Repo not initialized.</h2>
        <form>
          <div class="mui-textfield">
            <input size="50" placeholder="git@github.com:[...].git" v-model="remote_url" />
          </div>
          <div class="mui-textfield">
            <input size="50" placeholder="remote_branch, eg. gh-pages" v-model="remote_branch" />
          </div>
<!--
          <div class="mui-textfield">
            <textarea placeholder="SSH deploy key" v-model="public_key"></textarea>
          </div>
-->
        </form>
        <button class="mui-btn mui-btn--primary" type="button" @click="setup">Setup</button>
      </div>
    </div>
    <div v-else>
      <br/>
      <div class="mui-panel">
        <form>
          <div class="mui-textfield">
            <textarea placeholder="Commit message" v-model="message"></textarea>
          </div>
          <button type="button" class="mui-btn mui-btn--primary" @click="commit">Commit</button>
          <button v-if="remote_url" type="button" class="mui-btn mui-btn--danger" @click="$emit('push')">Push</button>
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
        <tr v-for="item of git.history">
          <td>{{item.date}}</td>
          <td>{{item.author_name}}</td>
          <td>{{item.message}}</td>
        </tr>
        </tbody>
      </table>

      <div class="mui-panel">
        <form>
          <div class="mui-textfield">
            <input size="50" placeholder="git@github.com:[...].git" v-model="remote_url" />
          </div>
          <div class="mui-textfield">
            <input size="50" placeholder="remote_branch, eg: gh-pages" v-model="remote_branch" />
          </div>
          <button type="button" class="mui-btn mui-btn--primary" @click="setup">Change remote</button>
          <div class="mui-textfield">
            <textarea rows="10" placeholder="Deploy key" readonly v-model="git.public_key" @click="copyEmail"></textarea>
          </div>
        </form>
      </div>
    </div>
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
      message: '',
      remote_url: '',
      remote_branch: ''
    }
  },
  created() {
    this.remote_url = this.git?.remote_url || '';
    this.remote_branch = this.git?.remote_branch || '';
  },
  methods: {
    setup() {
      this.$emit('setup', {
        remote_url: this.remote_url,
        remote_branch: this.remote_branch
      });
    },
    commit() {
      this.$emit('commit', {
        message: this.message
      });
    }
  }
}
</script>
