<template>
  <ErrorView v-if="errorMessage" :errorMessage="errorMessage">
  </ErrorView>
  <router-view v-else-if="isReady" class="router-view"></router-view>
  <ModalsContainer></ModalsContainer>
  <ToastsContainer></ToastsContainer>
</template>
<script>
import ModalsContainer from './modals/ModalsContainer.vue';
import ToastsContainer from './modals/ToastsContainer.vue';
import ErrorView from './pages/ErrorView.vue';

export default {
  data() {
    let errorMessage = '';

    if (!import.meta.env.SSR) {
      const el = document.querySelector('meta[name=errorMessage]');
      errorMessage = el ? el.getAttribute('content') : '';
    }

    return {
      errorMessage
    };
  },
  computed: {
    drive() {
      return this.$root.drive || {};
    },
    driveId() {
      return this.drive.id;
    },
    isReady() {
      if (!this.$route.meta?.requireDriveId) {
        return true;
      }
      if (!this.driveId) {
        return false;
      }
      return true;
    }
  },
  components: {
    ErrorView,
    ModalsContainer, ToastsContainer
  }
};
</script>
