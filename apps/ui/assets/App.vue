<template>
  <router-view class="view main-content"></router-view>
  <ModalsContainer></ModalsContainer>
</template>
<script>
import ModalsContainer from './modals/ModalsContainer.vue';

export default {
  components: {
    ModalsContainer
  }
};
</script>
