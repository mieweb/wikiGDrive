export const GitMixin = {
  methods: {
    async commit({ message, filePath }) {
      const response = await this.authenticatedClient.fetchApi(`/api/git/${this.driveId}/commit`, {
        method: 'post',
        headers: {
          'Content-type': 'application/json'
        },
        body: JSON.stringify({
          filePath,
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
