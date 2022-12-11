<template>
  <router-view class="view main-content"></router-view>
  <ModalsContainer></ModalsContainer>
  <ToastsContainer></ToastsContainer>
</template>
<script>
import ModalsContainer from './modals/ModalsContainer.vue';
import ToastsContainer from './modals/ToastsContainer.vue';

export default {
  components: {
    ModalsContainer, ToastsContainer
  }
};
</script>
