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
    goToGDrive(google) {
      window.open('https://drive.google.com/open?id=' + google.id);
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
    }
  }
};
