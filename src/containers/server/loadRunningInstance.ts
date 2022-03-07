import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

export async function loadRunningInstance() {
  const tmpdir = os.tmpdir();
  const fullPath = path.join(tmpdir, 'wikigdrive.running');
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath).toString();
    try {
      const json = JSON.parse(content);
      if (json.pid > 0) {
        try {
          process.kill(json.pid, 0);
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
