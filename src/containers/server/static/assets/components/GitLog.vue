<template>
  <div class="mui-container">
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
  methods: {
    open(url) {
      window.open(url, '_blank');
    }
  }
};
</script>
