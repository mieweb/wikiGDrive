'use strict';

import {LinkTranslator} from '../LinkTranslator';
import {LocalFile} from '../storage/LocalFilesStorage';
import {GoogleFile} from '../storage/GoogleFilesStorage';
import {NavigationHierarchy} from '../generateNavigationHierarchy';

export function generateDocumentFrontMatter(file: GoogleFile, localFile: LocalFile, linkTranslator: LinkTranslator, navigationHierarchy: NavigationHierarchy) {
  let frontMatter = '---\n';
  frontMatter += 'title: "' + file.name + '"\n';
  frontMatter += 'date: ' + localFile.modifiedTime + '\n';
  const htmlPath = linkTranslator.convertToRelativeMarkDownPath(localFile.localPath, '');
  if (htmlPath) {
    frontMatter += 'url: "' + htmlPath + '"\n';
  }
  if (file.lastAuthor) {
    frontMatter += 'author: ' + file.lastAuthor + '\n';
  }
  if (file.version) {
    frontMatter += 'version: ' + file.version + '\n';
  }
  frontMatter += 'id: ' + file.id + '\n';
  frontMatter += 'source: ' + 'https://drive.google.com/open?id=' + file.id + '\n';

  if (navigationHierarchy[file.id]) {
    const navigationData = navigationHierarchy[file.id];

    frontMatter += 'menu:\n';
    frontMatter += '    main:\n';
    frontMatter += '        name: "' + navigationData.name + '"\n';
    frontMatter += '        identifier: "' + navigationData.identifier + '"\n';
    if (navigationData.parent) {
      frontMatter += '        parent: "' + navigationData.parent + '"\n';
    }
    frontMatter += '        weight: ' + navigationData.weight + '\n';
  }

  frontMatter += '---\n';

  return frontMatter;
}
