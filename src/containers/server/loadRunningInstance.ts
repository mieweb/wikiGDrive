import process from 'node:process';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

export async function loadRunningInstance() {
  const tmpdir = os.tmpdir();
  const fullPath = path.join(tmpdir, 'wikigdrive.running');
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath).toString();
    try {
      const json = JSON.parse(content);
      if (json.pid > 0) {
        try {
          // kill -0 seems not to work on alpine for some reason
          if (!fs.existsSync('/proc/' + json.pid)) {
            return null;
          }
        } catch (err) {
          return null;
        }
      }
      return json;
    } catch (err) {
      return null;
    }
  }
}

export async function saveRunningInstance(port: number) {
  const tmpdir = os.tmpdir();
  const fullPath = path.join(tmpdir, 'wikigdrive.running');
  fs.writeFileSync(fullPath, JSON.stringify({ pid: process.pid, port }), { mode: 0o604 });
}
