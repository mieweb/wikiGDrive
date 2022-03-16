import yaml from 'js-yaml';

import {ConflictFile} from '../../../model/LocalFile';
import {FRONTMATTER_DUMP_OPTS} from './frontmatter';

export function generateConflictMarkdown(conflictFile: ConflictFile): string {
  const fmt = yaml.dump({
    id: conflictFile.id,
    title: conflictFile.title,
    conflicting: conflictFile.conflicting,
    fileName: conflictFile.fileName,
    mimeType: conflictFile.mimeType,
    date: conflictFile.modifiedTime
  }, FRONTMATTER_DUMP_OPTS);

  const frontmatter = '---\n' + fmt + '---\n';

  const mdList = conflictFile.conflicting.map(conflictingFile => {
    return `* [${conflictingFile.title}](${conflictingFile.realFileName})`;
  }).join('\n');

  return frontmatter + 'There were two documents with the same name in the same folder:\n\n' + mdList;
}
