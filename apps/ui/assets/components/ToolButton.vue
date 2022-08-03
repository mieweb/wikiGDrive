<template>
  <a class="btn btn-white text-primary ml-1" @click.prevent.stop="click()" href="" :aria-label="title" :title="title"
    :class="{ 'border-bottom': active, 'border-active': active }">
    <i v-if="icon" :class="icon"></i>
    <span v-else>{{title}}</span>
  </a>
</template>
<script>
export default {
  name: 'ToolButton',
  props: {
    active: Boolean,
    to: Object,
    title: String,
    icon: String
  },
  methods: {
    click() {
      if (this.to) {
        this.$router.push({ to: this.to });
        return;
      }
      this.$emit('click');
    }
  }
};
</script>
