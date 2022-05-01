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
    async commit({ message }) {
      const fileId = this.$route.params.fileId;
      await fetch(`/api/drive/${this.driveId}/git/commit`, {
        method: 'post',
        headers: {
          'Content-type': 'application/json'
        },
        body: JSON.stringify({
          fileId,
          message: message
        })
      });
      await this.fetch();
    },
    async push() {
      await fetch(`/api/drive/${this.driveId}/git/push`, {
        method: 'post',
        headers: {
          'Content-type': 'application/json'
        },
        body: JSON.stringify({})
      });
      await this.fetch();
    }
  }
};
