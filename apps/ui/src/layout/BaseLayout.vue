<template>
  <div id="main" :class="{ 'sidebar--collapsed': collapsed }">
    <slot name="navbar" :collapsed="collapsed" :collapse="collapse">
      <NavBar :sidebar="sidebar" :collapsed="collapsed" @collapse="collapse" />
    </slot>
    <main class="mainbar">
      <Sidebar v-if="sidebar" class="mainbar__sidebar">
        <slot name="sidebar" :collapsed="collapsed" :collapse="collapse"></slot>
      </Sidebar>
      <div class="mainbar__content">
        <slot></slot>
      </div>
    </main>
  </div>
</template>
<script>
import Sidebar from './SideBar.vue';
import NavBar from '../components/NavBar.vue';
import {UtilsMixin} from '../components/UtilsMixin.ts';
export default {
  components: {Sidebar, NavBar},
  mixins: [ UtilsMixin ],
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
      active: false,
      collapsed: false
    };
  },
  computed: {
    rootFolder() {
      return this.$root.drive;
    }
  },
  methods: {
    collapse(value) {
      if ('undefined' === typeof value) {
        this.collapsed = !this.collapsed;
      } else {
        this.collapsed = !!value;
      }
    }
  }
};
</script>
