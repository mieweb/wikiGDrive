import {LocalFile} from '../storage/LocalFilesStorage';
import {LinkTranslator} from '../LinkTranslator';

export function generateRedirectMarkdown(redirFile: LocalFile, redirectTo: LocalFile, linkTranslator: LinkTranslator) {
  let frontMatter = '---\n';
  // frontMatter += 'title: "' + redirFile.name + '"\n';
  frontMatter += 'title: "Redirect"\n';
  if (redirFile.modifiedTime) {
    frontMatter += 'date: "' + redirFile.modifiedTime + '"\n';
  }
  if (redirFile.version) {
    frontMatter += 'date: "' + redirFile.version + '"\n';
  }
  const htmlPath = linkTranslator.convertToRelativeMarkDownPath(redirFile.localPath, '');
  if (htmlPath) {
    frontMatter += 'url: "' + htmlPath + '"\n';
  }
  frontMatter += 'id: "' + redirFile.id + '"\n';
  frontMatter += 'source: "' + 'https://drive.google.com/open?id=' + redirFile.id + '"\n';

  frontMatter += '---\n';

  let md = frontMatter;
  md += 'Renamed to: ';
  const relativePath = linkTranslator.convertToRelativeMarkDownPath(redirectTo.localPath, redirFile.localPath);
  md += '[' + redirectTo.name + '](' + relativePath + ')\n';

  return md;
}
