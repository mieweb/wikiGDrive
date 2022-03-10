export const GitMixin = {
  methods: {
    async gitSetup({ remote_url }) {
      await fetch(`/api/drive/${this.driveId}/git`, {
        method: 'put',
        headers: {
          'Content-type': 'application/json'
        },
        body: JSON.stringify({
          remote_url: remote_url
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
