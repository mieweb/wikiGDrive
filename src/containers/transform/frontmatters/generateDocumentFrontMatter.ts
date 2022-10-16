import yaml from 'js-yaml';

import {NavigationHierarchy} from '../generateNavigationHierarchy';
import {MdFile} from '../../../model/LocalFile';
import {FRONTMATTER_DUMP_OPTS} from './frontmatter';

export function generateDocumentFrontMatter(localFile: MdFile, navigationHierarchy: NavigationHierarchy, links: string[],
                                            fm_without_version = false) {
  const obj = {
    id: localFile.id,
    title: localFile.title,
    date: !fm_without_version ? localFile.modifiedTime : undefined,
    version: !fm_without_version ? localFile.version : undefined,
    lastAuthor: !fm_without_version ? localFile.lastAuthor : undefined,
    mimeType: localFile.mimeType,
    links,
    // url: htmlPath,
    source: 'https://drive.google.com/open?id=' + localFile.id,
    wikigdrive: process.env.GIT_SHA
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
