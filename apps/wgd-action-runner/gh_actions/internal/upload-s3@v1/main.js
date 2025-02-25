#!/bin/node

import { exec } from 'child_process';

// Environment variables
const bucket = process.env.BUCKET; // The S3 bucket name

// Function to execute shell commands and return a promise
const execPromise = (command) => {
  return new Promise((resolve, reject) => {
    exec(command, (err, stdout, stderr) => {
      if (err) {
        reject(`Error: ${stderr || err}`);
      } else {
        resolve(stdout);
      }
    });
  });
};

try {
  // Step 1: Validate environment variables
  if (!bucket) {
    throw new Error('BUCKET environment variable is not set');
  }

  // Step 2: Sync files to S3 excluding CSS files
  const syncCommand1 = `s3cmd sync --add-header="Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0" --acl-public --guess-mime-type --no-mime-magic --delete-removed --exclude "*.css" /site/public/ s3://${bucket}`;
  console.log('Syncing files excluding CSS...');
  await execPromise(syncCommand1);
  console.log('Sync completed for non-CSS files.');

  // Step 3: Sync CSS files separately to S3 with a different MIME type
  const syncCommand2 = `s3cmd sync --add-header="Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0" --acl-public --delete-removed -m "text/css" --exclude "*" --include "*.css" /site/public/ s3://${bucket}`;
  console.log('Syncing CSS files...');
  await execPromise(syncCommand2);
  console.log('Sync completed for CSS files.');

} catch (error) {
  console.error('Error:', error);
  process.exit(1);
}
