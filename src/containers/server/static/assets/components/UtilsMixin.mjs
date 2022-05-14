export const UtilsMixin = {
  computed: {
    driveId() {
      return this.$route.params.driveId;
    },
    // folderPath
  },
  methods: {
    isFolder(google) {
      return google.mimeType === 'application/vnd.google-apps.folder';
    },
    isDocument(google) {
      return google.mimeType === 'application/vnd.google-apps.document';
    },
    isImage(google) {
      switch (google.mimeType) {
        case 'application/vnd.google-apps.drawing':
        case 'image/png':
        case 'image/jpg':
        case 'image/jpeg':
          return true;
      }
      return false;
    },
    openWindow(url, tab = '_blank') {
      window.open(url, tab);
    },
    goToGDocs(fileId) {
      window.open('https://drive.google.com/open?id=' + fileId);
    },
    goToGDrive(folderId) {
      window.open('https://drive.google.com/drive/u/0/folders/' + folderId);
    },
    refresh() {
      window.location.reload();
    },
    copyEmail(event) {
      event.target.select();
    },
    async sync(file) {
      file.syncing = true;
      try {
        await fetch(`/api/drive/${this.driveId}/sync/${file.google.id}`, {
          method: 'post'
        });
        // eslint-disable-next-line no-empty
      } finally {
      }
    },
    async fetchFile() {
      this.preview = {};
      this.git = {};

      const fileId = this.$route.params.fileId;

      if (fileId) {
        const response = await fetch(`/api/drive/${this.driveId}/file/${fileId}`);
        this.preview = await response.json();
        this.git = this.preview.git;

        this.notRegistered = !!this.preview.not_registered;
        if (this.notRegistered) {
          this.shareEmail = this.preview.share_email;
        }
      }
    },
  }
};
