import yaml from 'js-yaml';

import {NavigationHierarchy} from '../generateNavigationHierarchy';
import {MdFile} from '../../../model/LocalFile';
import {FRONTMATTER_DUMP_OPTS} from './frontmatter';

export function generateDocumentFrontMatter(localFile: MdFile, navigationHierarchy: NavigationHierarchy, links: string[]) {
  const obj = {
    id: localFile.id,
    title: localFile.title,
    date: localFile.modifiedTime,
    version: localFile.version,
    lastAuthor: localFile.lastAuthor,
    mimeType: localFile.mimeType,
    links,
    // url: htmlPath,
    source: 'https://drive.google.com/open?id=' + localFile.id
  };

  if (navigationHierarchy[localFile.id]) {
    const navigationData = navigationHierarchy[localFile.id];
    obj['menu'] = {
      main: {
        name: navigationData.name,
        identifier: navigationData.identifier,
        parent: navigationData.parent,
        weight: navigationData.weight,
      }
    };
  }

  const fmt = yaml.dump(obj, FRONTMATTER_DUMP_OPTS);

  return '---\n' + fmt + '---\n';
}
