import process from 'node:process';

import yaml from 'js-yaml';

import {FRONTMATTER_DUMP_OPTS} from './frontmatter.ts';
import {GoogleFile, MimeTypes} from '../../../model/GoogleFile.ts';
import {LocalFile} from '../../../model/LocalFile.ts';

export function generateDirectoryYaml(fileName: string, directory: GoogleFile, realFileNameToGenerated: { [realFileName: string]: LocalFile }) {
  return yaml.dump({
    type: 'directory',
    id: directory.id,
    title: directory.name,
    fileName: fileName,
    mimeType: MimeTypes.FOLDER_MIME,
    date: directory.modifiedTime,
    version: directory.version,
    fileMap: realFileNameToGenerated,
    wikigdrive: process.env.GIT_SHA
  }, FRONTMATTER_DUMP_OPTS);
}

export function parseDirectoryYaml(yamlContent: string) {
  return yaml.load(yamlContent);
}
