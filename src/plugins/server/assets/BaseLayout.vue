<template>
  <div id="main" :class="{'hide-sidedrawer': !active}">
    <div id="sidedrawer" class="mui--no-user-select">
      <Sidebar />
    </div>
    <header id="header">
      <div class="mui-appxbar">
        <div class="mui-container-fluid">
          <slot name="navbar">
          <table>
            <tr class="mui--appbar-height">
              <!--            <td>
                            <a class="sidedrawer-toggle mui&#45;&#45;visible-xs-inline-block mui&#45;&#45;visible-sm-inline-block js-show-sidedrawer" @click="active = !active">☰</a>
                            <a class="sidedrawer-toggle mui&#45;&#45;hidden-xs mui&#45;&#45;hidden-sm js-hide-sidedrawer" @click="active = !active">☰</a>
                            <span class="mui&#45;&#45;text-title mui&#45;&#45;visible-xs-inline-block">Brand.io</span>
                          </td>-->
              <td class="mui--text-right">
                  <ul class="mui-tabs__bar">
                    <li class="mui--is-active"><a data-mui-toggle="tab" data-mui-controls="pane-default-1">Tab-1</a></li>
                    <li><a data-mui-toggle="tab" data-mui-controls="pane-default-2">Tab-2</a></li>
                    <li><a data-mui-toggle="tab" data-mui-controls="pane-default-3">Tab-3</a></li>
                  </ul>
              </td>
            </tr>
          </table>
          </slot>
        </div>
      </div>
    </header>
    <div id="content-wrapper">
      <slot></slot>
    </div>
  </div>
</template>
<script>
import Sidebar from './Sidebar.vue';
export default {
  components: {Sidebar},
  data() {
    return {
      active: false
    }
  }
};
</script>
