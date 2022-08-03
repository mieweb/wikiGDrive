export const UtilsMixin = {
  computed: {
    isGDocsPreview() {
      return this.$route.name === 'gdocs';
    },
    syncing() {
      return this.active_jobs.length > 0;
    },
    changes() {
      return this.$root.changes || [];
    },
    changesMap() {
      return this.$root.changesMap || {};
    },
    jobs() {
      return this.$root.jobs || [];
    },
    jobsMap() {
      return this.$root.jobsMap || {};
    },
    active_jobs() {
      return this.jobs.filter(job => ['waiting', 'running'].includes(job.state));
    },
    last_job() {
      let kind = 'none';
      let dateStr = null;

      if (this.selectedFile) {
        const fileJob = this.jobs.find(job => job.type === 'sync' && job.payload === this.selectedFile.id && ['done', 'failed'].includes(job.state));
        if (fileJob?.finished) {
          kind = 'single';
          dateStr = new Date(fileJob.finished).toISOString();
        }
      }

      const syncAllJob = this.jobs.find(job => job.type === 'sync_all' && ['done', 'failed'].includes(job.state));
      if (syncAllJob?.finished) {
        kind = 'full';
        dateStr = new Date(syncAllJob.finished).toISOString();
      }

      return {
        kind, dateStr
      };
    },
    drive() {
      return this.$root.drive || {};
    },
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
    },
    previewUrl() {
      if (!this.folderPath) {
        return '';
      }
      if (!this.selectedFile) {
        return '';
      }
      const folderPath = this.folderPath.endsWith('/') ? this.folderPath : this.folderPath + '/';
      const fullUrlPreview = '/' + this.driveId + (this.drive.hugo_theme?.id ? `/${this.drive.hugo_theme?.id}` : '') + folderPath + this.selectedFile.fileName;
      return window.location.protocol + '//' + window.location.hostname + '/preview' +
        fullUrlPreview
          .replace(/.md$/, '')
          .replace(/_index$/, '');
    }
  },
  methods: {
    setActiveTab(tab, selectedFilePath) {
      if ('undefined' !== typeof selectedFilePath) {
        // this.$router.replace('/' + this.driveId + selectedFilePath + '#' + tab);
      } else {
        this.$router.replace({ hash: '#' + tab });
      }
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
    async syncSingle(selectedFile) {
      try {
        await this.authenticatedClient.fetchApi(`/api/sync/${this.driveId}/${selectedFile.id}`, {
          method: 'post'
        });
        // eslint-disable-next-line no-empty
      } finally {
      }
    },
    async syncAll() {
      await this.authenticatedClient.fetchApi(`/api/sync/${this.driveId}`, {
        method: 'post'
      });
    },
    async renderPreview() {
      await this.authenticatedClient.fetchApi(`/api/render_preview/${this.driveId}`, {
        method: 'post'
      });
    },
    downloadOdt(fileId) {
      const odtPath = `/api/drive/${this.driveId}/file/${fileId}.odt`;
      window.open(odtPath, '_blank');
    },
    downloadImage(fileId) {
      const odtPath = `/api/drive/${this.driveId}/transformed/${fileId}`;
      window.open(odtPath, '_blank');
    }
  }
};
