#!/bin/node

import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';

// Environment variables
const themeId = process.env.THEME_ID;
const themeUrl = process.env.THEME_URL;
const themeSubpath = process.env.THEME_SUBPATH;
const configToml = process.env.CONFIG_TOML;
const baseUrl = process.env.BASE_URL;

const siteDir = '/site';
const themeDir = '/themes';

// Function to execute a shell command and return a promise
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
  // Step 1: Remove files in the /site/public directory
  const publicDir = path.join(siteDir, 'public');
  if (fs.existsSync(publicDir)) {
    fs.rmSync(publicDir, { recursive: true, force: true });
  }

  // Step 2: Handle theme installation
  if (themeId) {
    const themePath = path.join(themeDir, themeId);

    if (fs.existsSync(themePath)) {
      // Theme exists, create symbolic link
      const themesDir = path.join(siteDir, 'themes');
      if (!fs.existsSync(themesDir)) {
        fs.mkdirSync(themesDir);
      }
      console.log(`Linking theme ${themeId} to ${themePath}`);
      fs.symlinkSync(themePath, path.join(themesDir, themeId), 'dir');
    } else {
      // Theme does not exist, clone from git
      console.log(`Using theme ${themeUrl} ${themeSubpath}`);
      await execPromise('git', ['clone', themeUrl, path.join(siteDir, 'themes', themeId)]);
    }

    // If THEME_SUBPATH is defined, move files
    if (themeSubpath) {
      const subpathDir = path.join(siteDir, 'themes', themeId, themeSubpath);
      if (fs.existsSync(subpathDir)) {
        const files = fs.readdirSync(subpathDir);
        files.forEach(file => {
          const srcPath = path.join(subpathDir, file);
          const destPath = path.join(siteDir, 'themes', themeId, file);
          fs.renameSync(srcPath, destPath);
        });
      }
    }
  }

  // Step 3: Remove _gen directory in /site/resources
  const genDir = path.join(siteDir, 'resources', '_gen');
  if (fs.existsSync(genDir)) {
    fs.rmSync(genDir, { recursive: true, force: true });
  }

  // Step 4: Print the contents of the config.toml file
  const configTomlPath = path.join(siteDir, 'tmp_dir', 'config.toml');
  if (fs.existsSync(configTomlPath)) {
    const configContent = fs.readFileSync(configTomlPath, 'utf8');
    console.log(configContent);
  }

  // Step 5: Run Hugo command
  const hugoCommand = 'hugo';
  const hugoArgs = ['--logLevel', 'info', `--config=${configToml}`, `--baseURL=${baseUrl}`];
  await execPromise(hugoCommand, hugoArgs);

  // Step 6: Clean up lock files
  const hugoBuildLock = path.join(siteDir, '.hugo_build.lock');
  if (fs.existsSync(hugoBuildLock)) {
    fs.rmSync(hugoBuildLock, { force: true });
  }

  // Step 7: Remove _gen directory again if it exists
  if (fs.existsSync(genDir)) {
    fs.rmSync(genDir, { recursive: true, force: true });
  }

  console.log('Hugo build completed successfully');
} catch (error) {
  console.error('Error:', error);
  process.exit(1);
}
