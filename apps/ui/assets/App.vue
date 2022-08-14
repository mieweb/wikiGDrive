<template>
  <router-view class="view main-content"></router-view>
  <Modals></Modals>
</template>
<script>
import Modals from './modals/Modals.vue';

export default {
  components: {
    Modals
  }
};
</script>
