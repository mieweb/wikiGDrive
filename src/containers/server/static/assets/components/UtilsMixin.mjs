export const UtilsMixin = {
  computed: {
    driveId() {
      return this.$root.drive.id;
    },
    gitInitialized() {
      return this.$root.drive?.git?.initialized || false;
    },
    github_url() {
      const remote_url = this.$root.drive?.git?.remote_url || '';
      if (remote_url.startsWith('git@github.com:')) {
        return remote_url.replace('git@github.com:', 'https://github.com/')
          .replace(/.git$/, '');
      }
      return '';
    }
  },
  methods: {
    setActiveTab(tab) {
      this.$router.replace({ hash: '#' + tab });
    },
    goToPath(path, target) {
      if (target) {
        window.open('/drive/' + this.driveId + path, target);
      } else {
        this.$router.push('/drive/' + this.driveId + path);
      }
    },
    isFolder(file) {
      if (!file) return false;
      return file.mimeType === 'application/vnd.google-apps.folder';
    },
    isDocument(file) {
      if (!file) return false;
      return file.mimeType === 'application/vnd.google-apps.document';
    },
    isMarkdown(file) {
      if (!file) return false;
      return file.mimeType === 'text/x-markdown';
    },
    isImage(file) {
      if (!file) return false;
      switch (file.mimeType) {
        case 'application/vnd.google-apps.drawing':
        case 'image/svg+xml':
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
    goToGDocs(fileId, target) {
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
    async syncSingle(selectedFile) {
      if (selectedFile.syncing) {
        return;
      }
      selectedFile.syncing = true;
      try {
        await fetch(`/api/sync/${this.driveId}/${selectedFile.id}`, {
          method: 'post'
        });
        // eslint-disable-next-line no-empty
      } finally {
      }
    }
  }
};
