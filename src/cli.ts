#!/usr/bin/env node

// This file is for loading without having to go thru WebPack.

require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    // 'module': 'es2020',
    // 'target': 'es2020'
  },
  dir: __dirname
});
require('./main');
