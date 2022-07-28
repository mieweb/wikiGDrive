export const GitMixin = {
  methods: {
    async commit({ message, filePath }) {
      await this.authenticatedClient.fetchApi(`/api/git/${this.driveId}/commit`, {
        method: 'post',
        headers: {
          'Content-type': 'application/json'
        },
        body: JSON.stringify({
          filePath,
          message: message
        })
      });
      await this.fetch();
    },
    async pull() {
      const response = await this.authenticatedClient.fetchApi(`/api/git/${this.driveId}/pull`, {
        method: 'post',
        headers: {
          'Content-type': 'application/json'
        },
        body: JSON.stringify({})
      });
      const json = await response.json();
      if (json.error) {
        alert(json.error);
      }
      await this.fetch();
    },
    async push({ message, filePath }) {
      if (message) {
        await this.authenticatedClient.fetchApi(`/api/git/${this.driveId}/commit`, {
          method: 'post',
          headers: {
            'Content-type': 'application/json'
          },
          body: JSON.stringify({
            filePath,
            message: message
          })
        });
      }

      const response = await this.authenticatedClient.fetchApi(`/api/git/${this.driveId}/push`, {
        method: 'post',
        headers: {
          'Content-type': 'application/json'
        },
        body: JSON.stringify({})
      });
      const json = await response.json();
      if (json.error) {
        alert(json.error);
      }
      await this.fetch();
    }
  }
};
