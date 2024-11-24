export const DEFAULT_TAB = 'html';

export async function disableElement(event, handler) {
  const origAttr = event.target.getAttribute('disabled');
  if ('disabled' === origAttr) {
    return;
  }

  try {
    event.target.setAttribute('disabled', 'disabled');
    return await handler();
  } finally {
    if (origAttr) {
      event.target.setAttribute('disabled', origAttr);
    } else {
      event.target.removeAttribute('disabled');
    }
  }
}

export const UtilsMixin = {
  computed: {
    isAddon() {
      return this.$route.name === 'gdocs';
    },
    isLogged() {
      return !!this.$root.user;
    },
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
      let durationStr = null;

      if (this.selectedFile) {
        const fileJob = this.jobs.find(job => job.type === 'sync' && job.payload === this.selectedFile.id && ['done', 'failed'].includes(job.state));
        if (fileJob?.finished) {
          kind = 'single';
          dateStr = new Date(fileJob.finished).toISOString();
          if (fileJob?.started) {
            durationStr = Math.round((fileJob?.finished - fileJob?.started) / 100) / 10 + 's';
          }
        }
      }

      const syncAllJob = this.jobs.find(job => job.type === 'sync_all' && ['done', 'failed'].includes(job.state));
      if (syncAllJob?.finished) {
        kind = 'full';
        dateStr = new Date(syncAllJob.finished).toISOString();
        if (syncAllJob?.started) {
          durationStr = Math.round((syncAllJob?.finished - syncAllJob?.started) / 100) / 10 + 's';
        }
      }

      return {
        kind, dateStr, durationStr
      };
    },
    last_transform() {
      let kind = 'none';
      let dateStr = null;
      let durationStr = null;

      const transformJob = this.jobs.find(job => job.type === 'transform' && ['done', 'failed'].includes(job.state));
      if (transformJob?.finished) {
        kind = 'full';
        dateStr = new Date(transformJob.finished).toISOString();
        if (transformJob?.started) {
          durationStr = Math.round((transformJob?.finished - transformJob?.started) / 100) / 10 + 's';
        }
      }

      return {
        kind, dateStr, durationStr
      };
    },
    drive() {
      return this.$root.drive || {};
    },
    driveId() {
      return this.drive.id;
    },
    gitStats() {
      return this.$root.gitStats;
    },
    github_url() {
      let remote_url = this.gitStats?.remote_url || '';

      if (!remote_url) return '';

      if (remote_url.startsWith('git@github.com:')) {
        remote_url = remote_url.replace('git@github.com:', 'https://github.com/').replace(/.git$/, '');
      }

      if (this.selectedFile && this.selectedFile.path) {
        return `${remote_url}/blob/${this.gitStats.remote_branch}/content${this.selectedFile.path}`
      }
      return remote_url;
    }
  },
  methods: {
    getActiveTab() {
      const parts = (this.$route.hash.replace(/^#/, '') || DEFAULT_TAB).split(':');
      return parts;
    },
    setActiveTab(tab: string, selectedFilePath?: string) {
      if (this.isAddon) {
        if (this.fullDrivePath) {
          window.open(this.fullDrivePath + '#' + tab, '_blank');
        } else
          if ('undefined' !== typeof selectedFilePath) {
            const routeData = this.$router.resolve('/drive/' + this.driveId + selectedFilePath + '#' + tab);
            window.open(routeData.href, '_blank');
          } else {
            const routeData = this.$router.resolve('/drive/' + this.driveId + '#' + tab);
            window.open(routeData.href, '_blank');
          }
        return;
      }

      if ('undefined' !== typeof selectedFilePath) {
        this.$router.replace('/drive/' + this.driveId + selectedFilePath + '#' + tab);
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
    isRedirect(file) {
      if (!file) return false;
      return !!file.redirectTo;
    },
    isConflict(file) {
      if (!file) return false;
      return Array.isArray(file.conflicting) && file.conflicting.length > 0;
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
    async syncSingle(event, selectedFile) {
      await disableElement(event, async () => {
        await this.authenticatedClient.fetchApi(`/api/sync/${this.driveId}/${selectedFile.id}`, {
          method: 'post'
        });
      });
    },
    async syncAll(event) {
      await disableElement(event, async () => {
        await this.authenticatedClient.fetchApi(`/api/sync/${this.driveId}`, {
          method: 'post'
        });
      });
    },
    async renderPreview(event) {
      await disableElement(event, async () => {
        await this.authenticatedClient.fetchApi(`/api/run_action/${this.driveId}/transform`, {
          method: 'post'
        });
      });
    },
    async transformAll(event) {
      await disableElement(event, async () => {
        await this.authenticatedClient.fetchApi(`/api/transform/${this.driveId}`, {
          method: 'post'
        });
      });
    },
    async uploadGdrive(event) {
      await disableElement(event, async () => {
        const response = await this.authenticatedClient.fetchApi('/api/gdrive/' + this.driveId + '/upload', { method: 'get' });
        const json = await response.json();
        if (json.shareUrl) {
          window.location = json.shareUrl;
        }
      });
    },
    async transformSingle(event, selectedFile) {
      await disableElement(event, async () => {
        await this.authenticatedClient.fetchApi(`/api/transform/${this.driveId}/${selectedFile.id}`, {
          method: 'post'
        });
      });
    },
    downloadOdt(fileId) {
      const odtPath = `/api/drive/${this.driveId}/file/${fileId}.odt`;
      window.open(odtPath, '_blank');
    },
    downloadImage(fileId) {
      const odtPath = `/api/drive/${this.driveId}/transformed/${fileId}`;
      window.open(odtPath, '_blank');
    },
    openAuthRedirWindow(authPath: string, callback?) {
      if (!authPath) {
        return;
      }

      const url = new URL(authPath, 'http://example.com');
      url.searchParams.set('popupWindow', 'true');
      authPath = url.pathname + (url.search || '');

      let authPopup;
      window['authenticated'] = (url) => {
        if (authPopup) {
          authPopup.close();
          authPopup = null;
        }
        window.location = url;
        if (callback) {
          callback();
        }
      };

      authPopup = window.open(authPath, '_auth', 'width=400,height=400,menubar=no,location=no,resizable=no,scrollbars=no,status=no');
    },
    async login(callback?) {
      const driveId = this.driveId ? this.driveId : 'none';
      const urlSearchParams = new URLSearchParams();
      // urlSearchParams.set('redirectTo', '/drive/' + (req['driveId'] || ''));
      urlSearchParams.set('redirectTo', window.location.pathname && window.location.pathname.startsWith('/drive') ? window.location.pathname : '/drive');
      const authPath = '/auth/' + driveId + '?' + urlSearchParams.toString();
      this.openAuthRedirWindow(authPath, callback);
    },
    async logout() {
      await this.authenticatedClient.fetchApi('/auth/logout', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        return_error: true
      });
      // await this.fetch();
      this.$router.push('/');
    }
  }
};
