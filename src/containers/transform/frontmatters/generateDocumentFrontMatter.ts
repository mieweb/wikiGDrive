import yaml from 'js-yaml';

import {MdFile} from '../../../model/LocalFile';
import {FRONTMATTER_DUMP_OPTS} from './frontmatter';

export function generateDocumentFrontMatter(localFile: MdFile, links: string[],
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
    wikigdrive: !fm_without_version ? process.env.GIT_SHA : undefined
  };

  const fmt = yaml.dump(obj, FRONTMATTER_DUMP_OPTS);

  return '---\n' + fmt + '---\n';
}
