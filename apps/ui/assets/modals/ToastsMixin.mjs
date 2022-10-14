export const ToastsMixin = {
  data() {
    return {
      toasts: []
    };
  },
  methods: {
    $addToast(toast) {
      switch (toast.type) {
        case 'transform:scheduled':
          this.$removeToastMatching(item => item.type.startsWith('transform:'));
          break;
        case 'transform:failed':
          this.$removeToastMatching(item => item.type.startsWith('transform:'));
          break;
        case 'transform:done':
          this.$removeToastMatching(item => item.type.startsWith('transform:'));
          break;
        case 'sync:done':
      }
      this.toasts.unshift(toast);
      this.$emit('change', this.toasts);

      if (toast.type.endsWith(':done')) {
        setTimeout(() => {
          this.$removeToastMatching(item => item.type === toast.type && item.payload === toast.payload);
        }, 5000);
      }
    },
    $removeToast() {
      if (this.toasts.length === 0) return;
      this.toasts.shift();
      this.$emit('change', this.toasts);
    },
    $removeToastAt(idx) {
      this.toasts.splice(idx, 1);
      this.$emit('change', this.toasts);
    },
    $removeToastMatching(func) {
      this.toasts = this.toasts.filter(item => !func(item));
    }
  }
};
