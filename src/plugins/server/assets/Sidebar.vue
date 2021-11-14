<template>
  <nav id="sidebarMenu" class="col-md-3 col-lg-2 d-md-block bg-light sidebar collapse">
    <div class="position-sticky pt-3">
      <ul class="nav flex-column">
        <li class="nav-item">
          <router-link class="nav-link active" to="/">
            Status
          </router-link>
          <router-link class="nav-link active" to="/logs">
            Logs
          </router-link>
        </li>
      </ul>
    </div>
  </nav>
</template>
