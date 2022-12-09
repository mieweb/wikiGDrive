<template>
  <div>
    SHARE
  </div>
</template>
<script>
await import('https://apis.google.com/js/api.js');

export default {
  name: 'ShareView',
  mounted() {
    const driveId = this.$route.params.driveId;
    window.gapi.load('drive-share', () => {
      console.log('shareClient', driveId);
      const shareClient = new window.gapi.drive.share.ShareClient();
      // shareClient.setOAuthToken('${token.access_token}');
      shareClient.setItemIds([driveId]);
      console.log(shareClient);
      shareClient.showSettingsDialog();
    });
  }
};
</script>
