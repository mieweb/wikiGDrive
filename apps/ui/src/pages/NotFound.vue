<template>
  <BaseLayout>
    <template v-slot:default>
      <StaticContent class="container" />
    </template>
  </BaseLayout>
</template>
<script>
import BaseLayout from '../layout/BaseLayout.vue';
import StaticContent from '../components/StaticContent.vue';

export default {
  components: {BaseLayout, StaticContent},
};
</script>
