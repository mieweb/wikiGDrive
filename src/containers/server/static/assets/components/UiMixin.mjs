export const DEFAULT_TAB = 'markdown';

export const UiMixin = {
  data() {
    return {
      rootFolder: {},
      notRegistered: false,
      shareEmail: ''
    };
  },
  computed: {
    github_url() {
      const remote_url = this.git?.remote_url || '';
      if (remote_url.startsWith('git@github.com:')) {
        return remote_url.replace('git@github.com:', 'https://github.com/')
          .replace(/.git$/, '');
      }
      return '';
    }
  },
  methods: {
    async syncSingle() {
      if (this.preview.syncing) {
        return;
      }
      this.preview.syncing = true;
      const fileId = this.$route.params.fileId;
      await fetch(`/api/drive/${this.driveId}/sync/${fileId}`, {
        method: 'post'
      });
      await this.fetchFile();
    }
  }
};
