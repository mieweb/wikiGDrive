export const GitMixin = {
  methods: {
    async commit({ message, filePaths, removeFilePaths }) {
      const response = await this.authenticatedClient.fetchApi(`/api/git/${this.driveId}/commit`, {
        method: 'post',
        headers: {
          'Content-type': 'application/json'
        },
        body: JSON.stringify({
          filePaths,
          removeFilePaths,
          message: message
        })
      });
      const json = await response.json();
      await this.fetch();
      if (json.error) {
        alert(json.error);
        window.location.hash = '#drive_logs';
      }
    },
    async commitBranch({ branch, message, filePaths, removeFilePaths }) {
      await this.authenticatedClient.fetchApi(`/api/run_action/${this.driveId}/branch`, {
        method: 'post',
        headers: {
          'Content-type': 'application/json'
        },
        body: JSON.stringify({
          branch,
          filePaths,
          removeFilePaths,
          message: message
        })
      });
    }
  }
};
