import winston from 'winston';
import {fileURLToPath} from 'url';
import htmlparser2 from 'htmlparser2';
import domutils from 'domutils';
import {Element} from 'domhandler';
import render from 'dom-serializer';

import {FileId} from '../../model/model';
import {MimeTypes} from '../../model/GoogleFile';
import {LocalFile} from '../../model/LocalFile';
import {Container, ContainerConfig, ContainerConfigArr, ContainerEngine} from '../../ContainerEngine';
import {GoogleDriveService} from '../../google/GoogleDriveService';
import {UserConfigService} from './UserConfigService';
import {FileContentService} from '../../utils/FileContentService';
import {getContentFileService} from '../transform/utils';
import {DirectoryScanner} from '../transform/DirectoryScanner';
import {getDesiredPath} from '../transform/LocalFilesGenerator';
import {markdownToHtml} from '../../google/markdownToHtml';
import {convertToAbsolutePath} from '../../LinkTranslator';

const __filename = fileURLToPath(import.meta.url);

interface FileToUpload {
  performRewrite?: string;
  path: string;
  file: LocalFile;
  parent: FileId;
}

export class UploadContainer extends Container {

  private progressNotifyCallback: ({total, completed}: { total?: number; completed?: number }) => void;
  private logger: winston.Logger;
  private googleDriveService: GoogleDriveService;
  private userConfigService: UserConfigService;
  private generatedFileService: FileContentService;

  private pathToIdMap = {};

  constructor(public readonly params: ContainerConfig, public readonly paramsArr: ContainerConfigArr = {}) {
    super(params, paramsArr);
  }

  async mount2(fileService: FileContentService, destFileService: FileContentService): Promise<void> {
    this.filesService = fileService;
    this.generatedFileService = destFileService;
    this.userConfigService = new UserConfigService(this.filesService);
    await this.userConfigService.load();
  }

  async init(engine: ContainerEngine): Promise<void> {
    await super.init(engine);
    this.logger = engine.logger.child({ filename: __filename, driveId: this.params.name });
    this.googleDriveService = new GoogleDriveService(this.logger, null);
    // this.auth = googleApiContainer.getAuth();
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async destroy(): Promise<void> {
  }

  async addIds(driveIdId: FileId, dirFileService: FileContentService, files: FileToUpload[]) {
    const access_token = this.params.access_token;

    let cnt = 0;
    for (const entry of files) {
      const file = entry.file;
      switch (file.mimeType) {
        case MimeTypes.IMAGE_SVG:
        case MimeTypes.MARKDOWN:
          if (file.id === 'TO_FILL') {
            cnt++;
          }
          break;
      }
    }

    if (cnt > 0) {
      const ids = await this.googleDriveService.generateIds(access_token, cnt);
      for (const entry of files) {
        const file = entry.file;
        switch (file.mimeType) {
          case MimeTypes.IMAGE_SVG:
          case MimeTypes.MARKDOWN:
            if (file.id === 'TO_FILL') {
              file.id = ids.splice(0, 1)[0];
            }
            break;
        }
      }
    }
  }

  async updateLinks(driveIdId: FileId, dirFileService: FileContentService, files: FileToUpload[]) {
    // Second pass because of error: Generated IDs are not supported for Docs Editors formats
    const access_token = this.params.access_token;

    for (const entry of files) {
      const file = entry.file;

      try {
        switch (file.mimeType) {
          case MimeTypes.MARKDOWN:
            if (file.id && file.id !== 'TO_FILL' && entry.performRewrite) {
              const rewrittenHtml = await this.rewriteLinks(entry.performRewrite, entry.path);
              const response = await this.googleDriveService.update(access_token, entry.parent, file.title, MimeTypes.HTML, rewrittenHtml, file.id);
            }
            break;
        }
      } catch (err) {
        this.logger.error('[' + entry.path + ']: ' + err.message);
      }
    }
  }

  async uploadFiles(driveIdId: FileId, dirFileService: FileContentService, files: FileToUpload[]) {
    const access_token = this.params.access_token;

    for (const entry of files) {
      const file = entry.file;

      try {
        switch (file.mimeType) {
          case MimeTypes.FOLDER_MIME:
            break;
          case MimeTypes.MARKDOWN:
            if (file.id && file.id !== 'TO_FILL') {
              const content = await dirFileService.readBuffer(entry.path);
              const html = await markdownToHtml(content);
              entry.performRewrite = html;
              const buffer = Buffer.from(new TextEncoder().encode(html));
              const response = await this.googleDriveService.upload(access_token, entry.parent, file.title, MimeTypes.HTML, buffer);
              file.id = response.id;
            }
            break;
          case MimeTypes.IMAGE_SVG:
            if (file.id && file.id !== 'TO_FILL') {
              const content = await dirFileService.readBuffer(entry.path);
              const response = await this.googleDriveService.upload(access_token, entry.parent, file.title, file.mimeType, content, file.id);
              file.id = response.id;
            }
            break;
        }
      } catch (err) {
        this.logger.error('[' + entry.path + ']: ' + err.message);
      }

      if (file.id && file.id !== 'TO_FILL') {
        this.pathToIdMap[entry.path] = file.id;
      }
    }
  }

  async uploadDir(folderId: FileId, dirFileService: FileContentService, parentPath: string): Promise<FileToUpload[]> {
    const retVal: FileToUpload[] = [];

    const scanner = new DirectoryScanner();
    const files = await scanner.scan(dirFileService);

    const access_token = this.params.access_token;

    const auth = {
      async getAccessToken(): Promise<string> {
        return access_token;
      }
    };

    const gdocFiles = await this.googleDriveService.listFiles(auth, { folderId });

    const map = {};
    for (const gdocFile of gdocFiles) {
      const name = getDesiredPath(gdocFile.name);
      map[name] = gdocFile;
    }

    for (const file of Object.values(files)) {
      const fullPath = parentPath + '/' + file.fileName;
      switch (file.mimeType) {
        case MimeTypes.FOLDER_MIME:
          if (file.id === 'TO_FILL') {
            if (!map[getDesiredPath(file.title)]) {
              const response = await this.googleDriveService.createDir(access_token, folderId, file.title);
              file.id = response.id;
            } else {
              file.id = map[file.title].id;
            }
          }
          await this.uploadDir(file.id, await dirFileService.getSubFileService(file.fileName), fullPath);
          break;
        case MimeTypes.MARKDOWN:
          if (map[getDesiredPath(file.title)]) {
            file.id = map[getDesiredPath(file.title)].id;
          }
          retVal.push({
            path: parentPath + '/' + file.fileName,
            file,
            parent: folderId
          });
          break;
        case MimeTypes.IMAGE_SVG:
          if (map[getDesiredPath(file.title)]) {
            file.id = map[getDesiredPath(file.title)].id;
          }

          retVal.push({
            path: parentPath + '/' + file.fileName,
            file,
            parent: folderId
          });
          break;
      }

      if (file.id && file.id !== 'TO_FILL') {
        this.pathToIdMap[fullPath] = file.id;
      }
    }

    return retVal;
  }

  async run() {
    const config = this.userConfigService.config;
    if (!config.transform_subdir) {
      throw new Error('Content subdirectory must be set and start with /');
    }

    this.pathToIdMap = {};

    const contentFileService = await getContentFileService(this.generatedFileService, this.userConfigService);
    const files = await this.uploadDir(this.params.folderId, contentFileService, '');
    await this.addIds(this.params.folderId, contentFileService, files);
    await this.uploadFiles(this.params.folderId, contentFileService, files);
    await this.updateLinks(this.params.folderId, contentFileService, files);
  }

  onProgressNotify(callback: ({total, completed, warnings}: { total?: number; completed?: number; warnings?: number }) => void) {
    this.progressNotifyCallback = callback;
  }

  private async rewriteLinks(html: string, entryPath: string): Promise<Buffer> {
    const dom = htmlparser2.parseDocument(html);

    const links = domutils.findAll((elem: Element) => {
      return ['a'].includes(elem.tagName) && !!elem.attribs?.href;
    }, dom.childNodes);
    const images = domutils.findAll((elem: Element) => {
      return ['img'].includes(elem.tagName) && !!elem.attribs?.src;
    }, dom.childNodes);

    for (const elem of links) {
      const targetPath = convertToAbsolutePath(entryPath, elem.attribs.href);
      if (!targetPath) {
        continue;
      }
      if (this.pathToIdMap[targetPath]) {
        elem.attribs.href = 'https://drive.google.com/open?id=' + this.pathToIdMap[targetPath];
      }
    }
    for (const elem of images) {
      const targetPath = convertToAbsolutePath(entryPath, elem.attribs.src);
      if (this.pathToIdMap[targetPath]) {
        elem.attribs.src = 'https://drive.google.com/open?id=' + this.pathToIdMap[targetPath];
      }
    }

    const rewrittenHtml = render(dom);
    return Buffer.from(new TextEncoder().encode(rewrittenHtml));
  }
}
