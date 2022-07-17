<template>
  <div id="main">
    <slot name="navbar">
      <NavBar />
    </slot>
    <div class="container-fluid">
      <div class="row">
        <div class="col-sm" v-if="sidebar">
          <Sidebar>
            <slot name="sidebar"></slot>
          </Sidebar>
        </div>
        <main class="col">
          <slot></slot>
        </main>
      </div>
    </div>
  </div>
</template>
<script>
import Sidebar from './SideBar.vue';
import NavBar from '../components/NavBar.vue';
export default {
  components: {Sidebar, NavBar},
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
