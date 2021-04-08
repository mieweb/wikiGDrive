import {LocalFile} from '../storage/LocalFilesStorage';

export function generateConflictMarkdown(conflictFile: LocalFile, conflicting: LocalFile[]) {
  let md = '';
  md += 'There were two documents with the same name in the same folder:\n';
  md += '\n';
  for (const conflictingFile of conflicting) {
    const relativePath = this.linkTranslator.convertToRelativeMarkDownPath(conflictingFile.localPath, conflictFile.localPath);
    md += '* [' + conflictingFile.name + '](' + relativePath + ')\n';
  }

  return md;
}
