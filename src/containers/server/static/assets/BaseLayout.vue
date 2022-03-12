<template>
  <div id="main" :class="{'hide-sidedrawer': !sidebar}">
    <header id="header" class="mui-appbar mui--z1" v-if="navbar">
      <slot name="navbar">
        <div class="mui-container">
        <table>
          <tr class="mui--appbar-height">
            <td class="mui--text-title">
              WikiGDrive
            </td>
            <td class="mui--text-right">
                <ul class="mui-list--inline mui--text-body2">
                  <li class="mui--is-active"><a data-mui-toggle="tab" data-mui-controls="pane-default-1">Tab-1</a></li>
                  <li><a >Tab-2</a></li>
                  <li><a >Tab-3</a></li>
                </ul>
            </td>
          </tr>
        </table>
        </div>
      </slot>
    </header>
    <div id="content-wrapper">
      <div id="sidedrawer" class="mui--no-user-select">
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
import Sidebar from './Sidebar.vue';
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
    }
  }
};
</script>
