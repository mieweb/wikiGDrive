const webpack = require('webpack');
const fs = require('fs');

module.exports = {
  target: 'node',
  plugins: [
    new webpack.BannerPlugin({
      banner: '#!/usr/bin/env node',
      raw: true,
    }),
    function () {
      this.plugin('done', () => {
        if (fs.existsSync(`${__dirname}/dist/main.js`)) {
          fs.chmodSync(`${__dirname}/dist/main.js`, '755');
        }
      });
    },
  ],
};
