export const GitMixin = {
  methods: {
    async gitSetup({ remote_url, remote_branch }) {
      await fetch(`/api/drive/${this.driveId}/git`, {
        method: 'put',
        headers: {
          'Content-type': 'application/json'
        },
        body: JSON.stringify({
          remote_url: remote_url,
          remote_branch: remote_branch
        })
      });
      await this.fetch();
    },
    async commit({ message, filePath }) {
      await fetch(`/api/drive/${this.driveId}/git/commit`, {
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
    async push({ message, filePath }) {
      if (message) {
        await fetch(`/api/drive/${this.driveId}/git/commit`, {
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

      const response = await fetch(`/api/drive/${this.driveId}/git/push`, {
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
