import * as yaml from 'js-yaml';

import {FRONTMATTER_DUMP_OPTS} from './frontmatter';
import {GoogleFile, MimeTypes} from '../../../model/GoogleFile';
import {LocalFile} from '../../../model/LocalFile';

export function generateDirectoryYaml(fileName: string, directory: GoogleFile, realFileNameToGenerated: { [realFileName: string]: LocalFile }) {
  return yaml.dump({
    type: 'directory',
    id: directory.id,
    title: directory.name,
    fileName: fileName,
    mimeType: MimeTypes.FOLDER_MIME,
    date: directory.modifiedTime,
    version: directory.version,
    fileMap: realFileNameToGenerated
  }, FRONTMATTER_DUMP_OPTS);
}

export function parseDirectoryYaml(yamlContent: string) {
  return yaml.load(yamlContent);
}
