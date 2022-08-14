<template>
  <div class="modal open" tabindex="-1" role="dialog">
    <div class="modal-dialog" role="document">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Authentication</h5>
        </div>
        <div class="modal-body">
          <p>You are not authenticated.</p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-primary" @click="open">Authenticate with Google</button>
        </div>
      </div>
    </div>
  </div>
</template>
<script>
export default {
  name: 'AuthModal',
  props: ['authPath'],
  data() {
    return {
      authPopup: null
    }
  },
  mounted() {
    window['authenticated'] = (url) => {
      this.$root.$removeModal();
      if (this.authPopup) {
        this.authPopup.close();
        this.authPopup = null;
      }
      window.location = url;
    };
  },
  methods: {
    open() {
      this.authPopup = window.open(this.authPath, '_auth', 'width=400,height=400,menubar=no,location=no,resizable=no,scrollbars=no,status=no')
    }
  }
};
</script>
