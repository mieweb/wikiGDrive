import fs from 'fs';
import crypto from 'crypto';
import path from 'path';

const cacheFile = path.join('/site', process.env.INPUT_KEY_FILE);
const cacheContent = fs.readFileSync(cacheFile, 'utf8');
const hash = crypto.createHash('sha256').update(cacheContent).digest('hex');

const sourceDir = '/site/' + process.env.INPUT_PATH;
const targetDir = '/action-cache/' + hash;

console.log('Cache action storing: ' + process.env.INPUT_PATH + ' ' + ((fs.existsSync(sourceDir) && !fs.existsSync(targetDir)) ? 'caching' : 'skipping'));

if (fs.existsSync(sourceDir) && !fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
  fs.cpSync(sourceDir, targetDir, { recursive: true });
}
