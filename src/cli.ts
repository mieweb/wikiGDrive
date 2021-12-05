#!/usr/bin/env node

// This file is for loading without having to go thru WebPack.

require('ts-node').register({
  transpileOnly: true,
  dir: __dirname
});
require('./main');
