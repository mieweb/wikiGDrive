<template>
  <div>
    <div class="mui-container">
      <br/><br/><br/><br/>
      <div class="mui-panel">
        <h2>Folder is not shared with WikiGDrive.</h2>
        <ol>
          <li>Go to <a :href="'https://drive.google.com/open?id=' + driveId" :target="driveId">folder</a></li>
          <li>Make if publicly readable <span v-if="shareEmail"><br/>or share with <input size="50" readonly :value="shareEmail" @click="copyEmail" /></span></li>
        </ol>
        <button class="mui-btn mui-btn--primary" type="button" @click="refresh">Retry</button>
      </div>
    </div>
  </div>
</template>
<script>
import {UtilsMixin} from '../components/UtilsMixin.mjs';

export default {
  mixins: [ UtilsMixin ],
  props: {
    shareEmail: {
      type: String
    }
  }
};
</script>
