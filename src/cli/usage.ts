import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class UsageError extends Error {
  public isUsageError = true;
}

function locateUsage(usageMarkdown: string, sectionPrefix: string): string {
  let inSection = false;
  const retVal = [];

  const lines = usageMarkdown.split('\n');
  for (const line of lines) {
    if (line.startsWith('## ' + sectionPrefix)) {
      inSection = true;
    } else if (line.startsWith('## ')) {
      inSection = false;
    } else {
      if (inSection) {
        retVal.push(line);
      }
    }
  }

  return retVal.join('\n');
}

export async function usage(filename: string) {
  const pkg = JSON.parse(new TextDecoder().decode(fs.readFileSync(path.resolve(__dirname, '..', '..', 'package.json'))));

  filename = path.basename(filename);

  const execName = filename.replace(/-.*$/, '');
  const sectionName = filename.replace(/^.*-(.*).ts/, '$1');


  const mdFilename = execName + '_usage.md';

  const usageMarkdown = new TextDecoder().decode(fs.readFileSync(path.resolve(__dirname, '..', '..', 'website', 'docs', 'usage', mdFilename)));

  const commandUsage = locateUsage(usageMarkdown, `${execName} ${sectionName}`) || locateUsage(usageMarkdown, `${execName} usage`);
  const allCommands = locateUsage(usageMarkdown, 'All commands');
  const commonOptions = locateUsage(usageMarkdown, 'Common options');

  console.log(
    `${pkg.name} version: ${pkg.version}, ${process.env.GIT_SHA}\n\nUsage:\n${commandUsage.trim()}\n\n${commonOptions.trim()}\n\n${allCommands.trim()}`);
}
