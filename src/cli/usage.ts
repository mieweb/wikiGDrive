import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const __dirname = import.meta.dirname;

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

function indentMarkdownCodes(markdown: string) {
  const retVal = [];

  const lines = markdown.split('\n');
  let inCode = false;
  for (const line of lines) {
    if (line === '```') {
      inCode = !inCode;
      continue;
    }

    if (inCode) {
      retVal.push('    ' + line);
    } else {
      retVal.push(line);
    }
  }

  return retVal.join('\n');
}

export async function usage(filename: string) {
  const pkg = JSON.parse(new TextDecoder().decode(fs.readFileSync(path.resolve(__dirname, '..', '..', 'package.json'))));

  filename = path.basename(filename);

  const execName = filename.replace(/-.*$/, '');
  const sectionName = filename.replace(/^.*-(.*).ts/, '$1');


  const mdFilename = execName + '-usage.md';

  const usageMarkdown = new TextDecoder().decode(fs.readFileSync(path.resolve(__dirname, '..', '..', 'website', 'docs', 'usage', mdFilename)));

  const indentedMarkdown = indentMarkdownCodes(usageMarkdown);

  const commandUsage = locateUsage(indentedMarkdown, `${execName} ${sectionName}`) || locateUsage(indentedMarkdown, `${execName} usage`);
  const allCommands = locateUsage(indentedMarkdown, 'All commands');
  const commonOptions = locateUsage(indentedMarkdown, 'Common options');

  console.log(
    `${pkg.name} version: ${pkg.version}, ${process.env.GIT_SHA}\n\nUsage:\n${commandUsage.trim()}\n\n${commonOptions.trim()}\n\n${allCommands.trim()}`);
}
