export const GitMixin = {
  methods: {
    async commit({ message, filePath }) {
      await fetch(`/api/git/${this.driveId}/commit`, {
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
      const response = await fetch(`/api/git/${this.driveId}/pull`, {
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
        await fetch(`/api/git/${this.driveId}/commit`, {
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

      const response = await fetch(`/api/git/${this.driveId}/push`, {
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
