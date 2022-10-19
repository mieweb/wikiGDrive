import {FileContentService} from '../../utils/FileContentService';
import {BinaryFile, ConflictFile, Directory, DrawingFile, LocalFile, MdFile, RedirFile} from '../../model/LocalFile';
import {frontmatter} from './frontmatters/frontmatter';
import {MimeTypes} from '../../model/GoogleFile';
import {FileId} from '../../model/model';
import yaml from 'js-yaml';
import {LOG_NAME} from './LocalLog';

export const RESERVED_NAMES = [LOG_NAME, '.wgd-directory.yaml', '.wgd-local-log.csv', '.wgd-local-links.csv',
  '.tree.json', '.gitignore'];

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

      if (await existingDirectory.isDirectory(realFileName)) {
        if (await existingDirectory.exists(`${realFileName}/.wgd-directory.yaml`)) {
          const yamlContent = await existingDirectory.readFile(`${realFileName}/.wgd-directory.yaml`);
          const props = yaml.load(yamlContent);
          if (props.type === 'directory' && props.id) {
            const directory: Directory = {
              type: 'directory',
              fileName: stripConflict(realFileName),
              id: props.id,
              mimeType: MimeTypes.FOLDER_MIME,
              modifiedTime: props.date,
              title: props.title,
              version: props.version
            };
            const map: {[realFileName: string]: LocalFile} = props.fileMap || {};
            this.files[realFileName] = directory;
          }
        }
        continue;
      }

      let yamlFile;
      if (await existingDirectory.exists('.wgd-directory.yaml')) {
        const yamlContent = await existingDirectory.readFile('.wgd-directory.yaml');
        const props = yaml.load(yamlContent);
        yamlFile = props.fileMap && props.fileMap[realFileName] ? props.fileMap[realFileName] : null;
      }

      if (realFileName.endsWith('.svg')) {
        const drawingFile: DrawingFile = {
          type: 'drawing',
          fileName: stripConflict(realFileName),
          id: yamlFile ? yamlFile.id : 'TO_FILL',
          modifiedTime: yamlFile ? yamlFile.modifiedTime : 'TO_FILL',
          version: yamlFile ? yamlFile.version : undefined,
          mimeType: 'image/svg+xml',
          title: stripConflict(realFileName)
        };
        this.files[realFileName] = drawingFile;
      } else
      if (realFileName.endsWith('.md')) {
        const markdown = (await existingDirectory.readFile(realFileName)).toString();
        // const localPath = existingDirectory.getVirtualPath() + realFileName;
        const localFile = this.parseMarkdown(markdown, realFileName);
        if (localFile) {
          if (!localFile.modifiedTime) localFile.modifiedTime = yamlFile.modifiedTime;
          if (!localFile.version) localFile.version = yamlFile.version;
          this.files[realFileName] = localFile;
        }
      } else {
        const binaryFile: BinaryFile = {
          type: 'binary',
          fileName: stripConflict(realFileName),
          id: yamlFile ? yamlFile.id : 'TO_FILL',
          modifiedTime: yamlFile ? yamlFile.modifiedTime : 'TO_FILL',
          version: yamlFile ? yamlFile.version : undefined,
          mimeType: 'application/binary',
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
