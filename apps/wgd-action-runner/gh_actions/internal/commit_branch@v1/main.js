#!/bin/node

import { execFile } from 'child_process';

// Environment variables
const branch = process.env.BRANCH; // The new branch name
const files = process.env.FILES; // The files to commit
const message = process.env.MESSAGE; // The commit message

// Function to execute shell commands and return a promise
const execPromise = (command, args) => {
  return new Promise((resolve, reject) => {
    execFile(command, args, (err, stdout, stderr) => {
      if (err) {
        reject(`Error: ${stderr || err}`);
      } else {
        resolve(stdout);
      }
    });
  });
};

try {
  // Step 1: Change directory to /repo
  process.chdir('/repo');

  // Step 2: Run git reset and clear stash
  await execPromise('git', ['reset', '--keep']);
  await execPromise('git', ['stash', 'clear']);

  // Step 3: Store the current commit hash
  const commit = await execPromise('git', ['rev-parse', 'HEAD']);
  const currentCommit = commit.trim(); // Remove any trailing newlines

  // Step 4: Refresh the git index and stash changes
  await execPromise('git', ['update-index', '--really-refresh']);
  await execPromise('git', ['stash', 'push', '--keep-index']);
  await execPromise('git', ['stash', 'list']);

  // Step 5: Apply the first stash, exit if error occurs
  try {
    await execPromise('git', ['stash', 'apply', 'stash@{0}']);
  } catch (error) {
    console.error('Error applying stash:', error);
    process.exit(1);
  }

  // Step 6: Create and checkout a new branch, commit changes
  try {
    await execPromise('git', ['branch', '-D', `wgd/${branch}`, '||', 'true']); // Force delete branch if it exists
    await execPromise('git', ['checkout', '-b', `wgd/${branch}`]);
    await execPromise('git', ['add', files]);
    await execPromise('git', ['commit', '-m', message]);
  } catch (error) {
    console.error('Error creating or committing the branch:', error);
    process.exit(1);
  }

  // Step 7: Checkout master and reset to the previous commit
  await execPromise('git', ['checkout', 'master', '--force']);
  await execPromise('git', ['reset', '--soft', currentCommit]);

  // Step 8: Apply the stash again
  await execPromise('git', ['stash', 'apply', 'stash@{0}']);

  console.log('Git operations completed successfully.');
} catch (error) {
  console.error('Error:', error);
  process.exit(1);
}
