export const ToastsMixin = {
  data() {
    return {
      toasts: []
    };
  },
  methods: {
    async $addToast(toast) {
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

      if (toast.type.startsWith('git_push:') || toast.type.startsWith('git_pull:')) {
        this.$removeToastMatching(item => item.type.startsWith('git_push:') || item.type.startsWith('git_pull:'));
      }

      if (toast.err === 'cannot push non-fastforwardable reference') {
        if (window.confirm('Git error: ' + toast.err + '. Do you want to reset git repository with remote branch?')) {
          await this.authenticatedClient.fetchApi(`/api/git/${this.driveId}/reset_remote`, {
            method: 'post'
          });
          window.location.hash = '#git_log';
        }
        return;
      }

      if (toast.err === 'rebase conflict') {
        if (window.confirm('Rebase conflict. Do you want to reset git repository with remote branch?')) {
          await this.authenticatedClient.fetchApi(`/api/git/${this.driveId}/reset_remote`, {
            method: 'post'
          });
          window.location.hash = '#git_log';
        }
        return;
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
