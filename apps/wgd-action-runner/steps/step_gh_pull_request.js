#!/bin/node

import https from 'https';

const ghToken = process.env.GH_TOKEN;
const ownerRepo = process.env.OWNER_REPO; // Make sure this is set as an environment variable
const message = process.env.MESSAGE; // Make sure this is set as an environment variable
const branch = process.env.BRANCH; // Make sure this is set as an environment variable
const remoteBranch = process.env.REMOTE_BRANCH; // Make sure this is set as an environment variable

if (!ghToken) {
  console.log('No env.GH_TOKEN');
  process.exit(1);
}

const data = JSON.stringify({
  title: message,
  body: message,
  head: `wgd/${branch}`,
  base: remoteBranch,
});

const options = {
  hostname: 'api.github.com',
  port: 443,
  path: `/repos/${ownerRepo}/pulls`,
  method: 'POST',
  headers: {
    'Accept': 'application/vnd.github+json',
    'Authorization': `Bearer ${ghToken}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
    'User-Agent': 'Node.js',
  },
};

https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('Response:', data);
  });
});
