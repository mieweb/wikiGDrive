import process from 'node:process';

import yaml from 'js-yaml';

import {LocalFile, RedirFile} from '../../../model/LocalFile.ts';
import {FRONTMATTER_DUMP_OPTS} from './frontmatter.ts';

export function generateRedirectMarkdown(redirFile: RedirFile, redirectTo: LocalFile): string {
  if (!redirFile.redirectTo) {
    throw new Error(`No redirectTo for redir: ${redirFile.id}`);
  }

  const obj = {
    id: redirFile.id,
    title: redirFile.title,
    date: redirFile.modifiedTime,
    source: 'https://drive.google.com/open?id=' + redirFile.id,
    mimeType: redirFile.mimeType,
    url: 'gdoc:' + redirFile.redirectTo,
    redirectTo: redirFile.redirectTo,
    autogenerated: true,
    wikigdrive: process.env.GIT_SHA
  };

  const fmt = yaml.dump(obj, FRONTMATTER_DUMP_OPTS);

  const frontMatter = '---\n' + fmt + '---\n';

  // const relativePath = convertToRelativeMarkDownPath(redirectTo.localPath, redirFile.localPath);

  //    /redir.html?fileId=${redirFile.redirectTo}
  // log of renames
  const md = frontMatter + 'Renamed to: [' + redirectTo.title + '](gdoc:' + redirFile.redirectTo + ')\n';

  return md;
}
