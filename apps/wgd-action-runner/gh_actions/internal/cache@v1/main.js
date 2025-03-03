import fs from 'fs';
import crypto from 'crypto';
import path from 'path';

const cacheFile = path.join('/site', process.env.INPUT_KEY_FILE);
const cacheContent = fs.readFileSync(cacheFile, 'utf8');
const hash = crypto.createHash('sha256').update(cacheContent).digest('hex');

const sourceDir = '/action-cache/' + hash;
const targetDir = '/site/' + process.env.INPUT_PATH;

console.log('Cache action restoring: ' + process.env.INPUT_PATH + ' ' + (fs.existsSync(sourceDir) ? 'restoring' : 'skipping'));

if (fs.existsSync(sourceDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
  fs.cpSync(sourceDir, targetDir, { recursive: true });
}
