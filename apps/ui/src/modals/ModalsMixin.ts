export const ModalsMixin = {
  data() {
    return {
      modals: []
    };
  },
  methods: {
    $addModal(params) {
      this.modals.unshift(params);
      this.$emit('change', this.modals);
    },
    $removeModal() {
      if (this.modals.length === 0) return;
      this.modals.shift();
      this.$emit('change', this.modals);
    }
  }
};
