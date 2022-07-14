<template>
  <BaseLayout>
    <template v-slot:navbar>
      <nav class="bg-primary">
        <span class="navbar-brand">WikiGDrive</span>
      </nav>
    </template>

    <template v-slot:default>
      <div>
        <div class="container">
          404 NOT FOUND
        </div>
      </div>
    </template>
  </BaseLayout>
</template>
<script>
import BaseLayout from '../layout/BaseLayout.vue';

export default {
  components: {BaseLayout},
  created() {
    console.log(this.$route);
  }
};
</script>
