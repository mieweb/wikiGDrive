<template>
  <div class="context-menu" ref="container" :style="{
                'display': isOpen ? 'block' : 'none',
                'left': `${position.x}px`,
                'top': `${position.y}px`,
        }">
    <slot :ctx="ctx" />
  </div>
</template>

<script lang="ts">
export default {
  data() {
    return {
      isOpen: false,
      position: {
        x: 0,
        y: 0,
      },
      ctx: null
    };
  },
  methods: {
    open(event: MouseEvent, ctx) {
      if (event) {
        this.position.x = event.x;
        this.position.y = event.y;
      }

      this.ctx = ctx;
      this.isOpen = true;
    },
    close() {
      this.isOpen = false;
    },
  },
  mounted() {
    document.addEventListener('click', e => {
      if (!this.$refs.container || !this.isOpen)
        return;
      const insideMenu = this.$refs.container.contains(e.target);
      if (!insideMenu)
        this.isOpen = false;
    });
  },
};
</script>
<style scoped>
.context-menu {
  z-index: 10000;
  position: fixed;
}
</style>
