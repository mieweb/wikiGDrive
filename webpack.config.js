const webpack = require('webpack'); // eslint-disable-line @typescript-eslint/no-var-requires
const fs = require('fs'); // eslint-disable-line @typescript-eslint/no-var-requires

module.exports = {
  target: 'node',
  devtool: 'source-map',
  externals: {
    'sharp': 'commonjs sharp'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader'
        }
      },
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: 'ts-loader',
      }
    ],
  },
  resolve: {
    extensions: [ '.ts', '.js' ]
  },
  plugins: [
    new webpack.BannerPlugin({
      banner: '#!/usr/bin/env node',
      raw: true,
    }),
    function () {
      this.hooks.done.tap('ChmodPlugin', () => {
        if (fs.existsSync(`${__dirname}/dist/main.js`)) {
          fs.chmodSync(`${__dirname}/dist/main.js`, '755');
        }
      });
    }
  ],
};
