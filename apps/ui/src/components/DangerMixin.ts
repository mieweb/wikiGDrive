export const DangerMixin = {
  methods: {
    async nukeGitDir() {
      if (!window.confirm('Are you sure you want to remove .git directory?')) {
        return;
      }

      await this.authenticatedClient.fetchApi(`/api/config/${this.driveId}/prune_git`, {
        method: 'post'
      });

      window.location.reload();
    },
    async resetToLocal() {
      if (!window.confirm('Are you sure?')) {
        return;
      }

      await this.authenticatedClient.fetchApi(`/api/git/${this.driveId}/reset_local`, {
        method: 'post'
      });
    },
    async resetToRemote() {
      if (!window.confirm('Are you sure?')) {
        return;
      }

      await this.authenticatedClient.fetchApi(`/api/git/${this.driveId}/reset_remote`, {
        method: 'post'
      });
    },
    async removeUntracked() {
      if (!window.confirm('Are you sure?')) {
        return;
      }

      await this.authenticatedClient.fetchApi(`/api/git/${this.driveId}/remove_untracked`, {
        method: 'post'
      });
    },
    async nukeContentDir() {
      if (!window.confirm('Are you sure you want to remove everything?')) {
        return;
      }

      await this.authenticatedClient.fetchApi(`/api/config/${this.driveId}/prune_transform`, {
        method: 'post'
      });

      window.location.reload();
    },
    async nukeAll() {
      if (!window.confirm('Are you sure you want to remove everything?')) {
        return;
      }

      await this.authenticatedClient.fetchApi(`/api/config/${this.driveId}/prune_all`, {
        method: 'post'
      });

      window.location.reload();
    }
  }
};
