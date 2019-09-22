const webpack = require('webpack');
const fs = require('fs');

module.exports = {
  plugins: [
    new webpack.BannerPlugin({
      banner: '#!/usr/bin/env node',
      raw: true,
    }),
    function () {
      this.plugin('done', () => {
        fs.chmodSync(`${__dirname}/dist/main.js`, '755');
      });
    },
  ],
};
