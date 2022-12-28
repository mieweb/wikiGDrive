<template>
  <div>
    <div class="container mt-5">
      <div class="card">
        <h2 class="card-header">Error.</h2>
        <div class="card-body">
          <p>{{errorMessage}}</p>
          <button v-if="hasLoginButton" class="btn btn-secondary" @click="login">Login</button>
        </div>
      </div>

      <br/>
      <div class="card">
        <div class="card-body">
          Go back to <a href="/">homepage</a>
        </div>
      </div>
    </div>
  </div>
</template>
<script>
import {UtilsMixin} from '../components/UtilsMixin.ts';

export default {
  mixins: [ UtilsMixin ],
  props: {
    errorMessage: {
      type: String
    }
  },
  computed: {
    hasLoginButton() {
      if (this.errorMessage.indexOf('Insufficient Permission') > -1) {
        return true;
      }
      return false;
    }
  },
  methods: {
    async login() {
      const response = await this.authenticatedClient.fetchApi('/auth', {
        headers: {
          'Accept': 'application/json'
        },
        return_error: true
      });
      const json = await response.json();
      this.openAuthRedirWindow(json.authPath);
    },
  }
};
</script>
