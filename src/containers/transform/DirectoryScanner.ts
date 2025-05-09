import yaml from 'js-yaml';

import {FileContentService} from '../../utils/FileContentService.ts';
import {BinaryFile, ConflictFile, Directory, DrawingFile, LocalFile, MdFile, RedirFile} from '../../model/LocalFile.ts';
import {frontmatter} from './frontmatters/frontmatter.ts';
import {MimeTypes} from '../../model/GoogleFile.ts';
import {FileId} from '../../model/model.ts';
import {LOG_NAME} from './LocalLog.ts';

export const RESERVED_NAMES = [LOG_NAME, '.wgd-directory.yaml', '.wgd-local-log.csv', '.wgd-local-links.csv',
  '.tree.json', '.private'];

export const RESERVED_DIR_NAMES = ['.git'];

export function isTextFileName(fileName) {
  if (fileName.endsWith('.txt')) {
    return true;
  }
  if (fileName.endsWith('.gitignore')) {
    return true;
  }
  if (fileName.endsWith('.ts')) {
    return true;
  }
  if (fileName.endsWith('.css')) {
    return true;
  }
  if (fileName.endsWith('.md')) {
    return true;
  }
  return false;
}

export function stripConflict(localPath: string) {
  const parts = localPath.split('.');
  parts[0] = parts[0].replace(/@[0-9]+$/, '');
  return parts.join('.');
}

export function appendConflict(localPath: string, no: number) {
  const parts = localPath.split('.');
  parts[0] = parts[0] + `@${no}`;
  return parts.join('.');
}

interface LocalFileMap {
  [realFileName: string]: LocalFile;
}

export class DirectoryScanner {
  private files: LocalFileMap = {};

  public parseMarkdown(markdown: string, localPath: string): LocalFile {
    const parsed = frontmatter(markdown);
    const props = parsed.data;

    if (!props) {
      return null;
    }

    if (Array.isArray(props.conflicting)) {
      const conflictFile: ConflictFile = {
        type: 'conflict',
        id: props.id,
        title: props.title,
        modifiedTime: props.date,
        mimeType: props.mimeType || MimeTypes.MARKDOWN,
        conflicting: Array.isArray(props.conflicting) ? props.conflicting : [],
        fileName: stripConflict(localPath),
      };
      return conflictFile;
    }

    if (props.redirectTo) {
      const redirFile: RedirFile = {
        type: 'redir',
        id: props.id,
        title: props.title,
        modifiedTime: props.date,
        mimeType: props.mimeType || MimeTypes.MARKDOWN,
        fileName: stripConflict(localPath),
        redirectTo: props.redirectTo,
      };
      return redirFile;
    }

    const mdFile: MdFile = {
      type: 'md',
      id: props.id,
      version: props.version,
      title: props.title,
      modifiedTime: props.date,
      mimeType: props.mimeType || MimeTypes.MARKDOWN,
      lastAuthor: props.lastAuthor,
      fileName: stripConflict(localPath)
    };
    return mdFile;
  }

  async scanDir(existingDirectory: FileContentService): Promise<LocalFileMap> {
    if (await existingDirectory.exists('.wgd-directory.yaml')) {
      const yamlContent = await existingDirectory.readFile('/.wgd-directory.yaml');
      const props = yaml.load(yamlContent);
      if (props.type === 'directory' && props.id) {
        const map: LocalFileMap = props.fileMap || {};
        return map;
      }
    }
    return {};
  }

  async scan(existingDirectory: FileContentService): Promise<LocalFileMap> {
    this.files = {};
    const files = await existingDirectory.list();
    for (const realFileName of files) {
      if (RESERVED_NAMES.indexOf(realFileName) > -1) {
        continue;
      }

      if (!await existingDirectory.exists(realFileName)) {
        continue;
      }

      if (await existingDirectory.isDirectory(realFileName)) {
        if (realFileName.endsWith('.assets')) {
          continue;
        }

        const props = await (async () => {
          if (await existingDirectory.exists(`${realFileName}/.wgd-directory.yaml`)) {
            const yamlContent = await existingDirectory.readFile(`${realFileName}/.wgd-directory.yaml`);
            return yaml.load(yamlContent);
          }
          return undefined;
        })();

        if (props && props.type === 'directory' && props.id) {
          const directory: Directory = {
            type: 'directory',
            fileName: stripConflict(realFileName),
            id: props.id,
            mimeType: MimeTypes.FOLDER_MIME,
            modifiedTime: props.date,
            title: props.title,
            version: props.version
          };
          this.files[realFileName] = directory;
        } else {
          if (RESERVED_DIR_NAMES.indexOf(realFileName) > -1) {
            continue;
          }
          const directory: Directory = {
            type: 'directory',
            fileName: stripConflict(realFileName),
            id: 'TO_FILL',
            mimeType: MimeTypes.FOLDER_MIME,
            modifiedTime: 'TO_FILL',
            title: stripConflict(realFileName)
          };
          this.files[realFileName] = directory;
        }
        continue;
      }

      if (realFileName.endsWith('.debug.xml')) {
        continue;
      }

      const props = await (async () => {
        if (await existingDirectory.exists('.wgd-directory.yaml')) {
          const yamlContent = await existingDirectory.readFile('.wgd-directory.yaml');
          return yaml.load(yamlContent);
        }
        return undefined;
      })();

      const yamlFile = props?.fileMap && props.fileMap[realFileName] ? props.fileMap[realFileName] : null;

      if (realFileName.endsWith('.svg')) {
        const drawingFile: DrawingFile = {
          type: 'drawing',
          fileName: stripConflict(realFileName),
          id: yamlFile ? yamlFile.id : 'TO_FILL',
          modifiedTime: yamlFile ? yamlFile.modifiedTime : 'TO_FILL',
          version: yamlFile ? yamlFile.version : undefined,
          mimeType: 'image/svg+xml',
          title: stripConflict(realFileName).replace(/.svg$/, '')
        };
        this.files[realFileName] = drawingFile;
      } else
      if (realFileName.endsWith('.md')) {
        const markdown = (await existingDirectory.readFile(realFileName)).toString();
        // const localPath = existingDirectory.getVirtualPath() + realFileName;
        const localFile = this.parseMarkdown(markdown, realFileName);
        if (localFile) {
          if (!localFile.modifiedTime) localFile.modifiedTime = yamlFile?.modifiedTime;
          if (!localFile.version) localFile.version = yamlFile?.version;
          this.files[realFileName] = localFile;
        } else {
          const mdFile: MdFile = {
            type: 'md',
            fileName: stripConflict(realFileName),
            id: yamlFile ? yamlFile.id : 'TO_FILL',
            modifiedTime: yamlFile ? yamlFile.modifiedTime : 'TO_FILL',
            version: undefined,
            mimeType: 'text/x-markdown',
            title: stripConflict(realFileName).replace(/.md/, ''),
            lastAuthor: ''
          };
          this.files[realFileName] = mdFile;
        }
      } else {
        const binaryFile: BinaryFile = {
          type: 'binary',
          fileName: stripConflict(realFileName),
          id: yamlFile ? yamlFile.id : 'TO_FILL',
          modifiedTime: yamlFile ? yamlFile.modifiedTime : 'TO_FILL',
          version: yamlFile ? yamlFile.version : undefined,
          mimeType: (realFileName => {
            if (realFileName.endsWith('.pdf')) return 'application/pdf';
            if (realFileName.endsWith('.json')) return 'text/json';
            if (realFileName.endsWith('.js')) return 'text/javascript';
            if (realFileName.endsWith('.sh')) return 'text/x-sh';
            if (realFileName.endsWith('.toml')) return 'text/toml';
            if (isTextFileName(realFileName)) return 'text/plain';
            return 'application/binary';
          })(realFileName),
          title: stripConflict(realFileName)
        };
        this.files[realFileName] = binaryFile;
      }
    }

    return this.files;
  }

  getFiles() {
    return this.files;
  }

  getFileById(fileId: FileId): LocalFile {
    const entry = Object.entries(this.files).find(f => f[1].id === fileId);
    return entry ? entry[1] : null;
  }
}
