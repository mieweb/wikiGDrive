<template>
  <div>
    <header class="navbar navbar-dark sticky-top bg-dark flex-md-nowrap p-0 shadow">
      <a class="navbar-brand col-md-3 col-lg-2 me-0 px-3" href="#">wikigdrive</a>
      <button class="navbar-toggler position-absolute d-md-none collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#sidebarMenu" aria-controls="sidebarMenu" aria-expanded="false" aria-label="Toggle navigation">
        <span class="navbar-toggler-icon"></span>
      </button>
    </header>

    <div class="container-fluid">
      <div class="row">
        <Sidebar />

        <main class="col-md-9 ms-sm-auto col-lg-10 px-md-4">
          <router-view class="view main-content"></router-view>
        </main>
      </div>
    </div>

  </div>
</template>
<script>
import Sidebar from './Sidebar.vue';
export default {
  components: {Sidebar}
};
</script>
