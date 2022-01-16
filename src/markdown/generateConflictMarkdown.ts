import {LocalFile} from '../storage/LocalFilesStorage';
import {LinkTranslator} from '../LinkTranslator';

export function generateConflictMarkdown(conflictFile: LocalFile, conflicting: LocalFile[], linkTranslator: LinkTranslator) {
  let md = '';
  md += 'There were two documents with the same name in the same folder:\n';
  md += '\n';
  for (const conflictingFile of conflicting) {
    const relativePath = linkTranslator.convertToRelativeMarkDownPath(conflictingFile.localPath, conflictFile.localPath);
    md += '* [' + conflictingFile.name + '](' + relativePath + ')\n';
  }

  return md;
}
