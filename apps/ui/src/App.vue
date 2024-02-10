<template>
  <ErrorView v-if="errorMessage" :errorMessage="errorMessage">
  </ErrorView>
  <router-view v-else class="router-view"></router-view>
  <ModalsContainer></ModalsContainer>
  <ToastsContainer></ToastsContainer>
</template>
<script>
import ModalsContainer from './modals/ModalsContainer.vue';
import ToastsContainer from './modals/ToastsContainer.vue';
import ErrorView from './pages/ErrorView.vue';

export default {
  data() {
    const el = document.querySelector('meta[name=errorMessage]');
    return {
      errorMessage: el ? el.getAttribute('content') : ''
    };
  },
  components: {
    ErrorView,
    ModalsContainer, ToastsContainer
  }
};
</script>
