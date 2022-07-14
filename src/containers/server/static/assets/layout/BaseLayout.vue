<template>
  <div id="main" :class="{'hide-sidedrawer': !sidebar}">
    <slot name="navbar">
      <nav class="bg-primary"></nav>
    </slot>
    <div id="content-wrapper">
      <div id="sidedrawer" class="">
        <Sidebar>
          <slot name="sidebar"></slot>
        </Sidebar>
      </div>
      <main>
        <slot></slot>
      </main>
    </div>
  </div>
</template>
<script>
import Sidebar from './SideBar.vue';
export default {
  components: {Sidebar},
  props: {
    navbar: {
      type: Boolean,
      default: true
    },
    sidebar: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      active: false
    };
  }
};
</script>
