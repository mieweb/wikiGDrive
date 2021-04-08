import {LocalFile} from '../storage/LocalFilesStorage';
import {LinkTranslator} from '../LinkTranslator';
import {LocalGoogleFile} from './generateConflictMarkdown';

export function generateRedirectMarkdown(redirFile: LocalFile, redirectTo: LocalGoogleFile, linkTranslator: LinkTranslator) {
  if (!redirectTo.googleFile) {
    return;
  }
  if (!redirectTo.localFile) {
    return;
  }

  let frontMatter = '---\n';
  // frontMatter += 'title: "' + redirFile.name + '"\n';
  frontMatter += 'title: "Redirect"\n';
  frontMatter += 'date: ' + redirFile.modifiedTime + '\n';
  const htmlPath = this.linkTranslator.convertToRelativeMarkDownPath(redirFile.localPath, '');
  if (htmlPath) {
    frontMatter += 'url: "' + htmlPath + '"\n';
  }
  frontMatter += 'id: ' + redirFile.id + '\n';
  frontMatter += 'source: ' + 'https://drive.google.com/open?id=' + redirFile.id + '\n';

  frontMatter += '---\n';

  let md = frontMatter;
  md += 'Renamed to: ';
  const relativePath = linkTranslator.convertToRelativeMarkDownPath(redirectTo.localFile.localPath, redirFile.localPath);
  md += '[' + redirectTo.googleFile.name + '](' + relativePath + ')\n';

  return md;
}
