<template>
  <BaseLayout>
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
