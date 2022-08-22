export const GitMixin = {
  methods: {
    async commit({ message, filePath, removeFilePath }) {
      const response = await this.authenticatedClient.fetchApi(`/api/git/${this.driveId}/commit`, {
        method: 'post',
        headers: {
          'Content-type': 'application/json'
        },
        body: JSON.stringify({
          filePath,
          removeFilePath,
          message: message
        })
      });
      const json = await response.json();
      await this.fetch();
      if (json.error) {
        alert(json.error);
        window.location.hash = '#drive_logs';
      } else {
        alert('Commited');
      }
    }
  }
};
