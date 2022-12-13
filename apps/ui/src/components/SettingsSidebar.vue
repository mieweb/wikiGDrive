<template>
  <ul class="nav nav-tabs nav-horizontal flex-column">
    <li class="nav-item">
      <a class="nav-link" :class="{active: $route.hash === '#drive_config'}" href="#drive_config">Sync settings</a>
    </li>
    <li class="nav-item">
      <a class="nav-link" :class="{active: $route.hash === '#git_settings'}" href="#git_settings">Git settings</a>
    </li>
    <li class="nav-item">
      <a class="nav-link" :class="{active: $route.hash === '#drive_danger'}" href="#drive_danger">Danger zone</a>
    </li>
  </ul>
</template>
