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
import {UtilsMixin} from './UtilsMixin.ts';

export default {
  name: 'AuthModal',
  props: ['authPath'],
  mixins: [ UtilsMixin ],
  methods: {
    open() {
      this.openAuthRedirWindow(this.authPath, () => {
        this.$root.$removeModal();
      });
    }
  }
};
</script>
