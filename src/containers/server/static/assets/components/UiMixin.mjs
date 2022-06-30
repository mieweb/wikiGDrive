export const DEFAULT_TAB = 'html';

export const UiMixin = {
  data() {
    return {
      rootFolder: {},
      notRegistered: false,
      shareEmail: ''
    };
  },
  methods: {
    async syncSingle() {
      if (this.selectedFile.syncing) {
        return;
      }
      this.selectedFile.syncing = true;
      const fileId = this.selectedFile.id;
      await fetch(`/api/sync/${this.driveId}/${fileId}`, {
        method: 'post'
      });
      await this.fetch();
    }
  }
};
