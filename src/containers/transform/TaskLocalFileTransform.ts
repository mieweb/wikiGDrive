import winston from 'winston';
import process from 'node:process';

import {QueueTask} from '../google_folder/QueueTask.ts';
import {FileContentService} from '../../utils/FileContentService.ts';
import {GoogleFile, MimeTypes} from '../../model/GoogleFile.ts';
import {BinaryFile, DrawingFile, LocalFile, MdFile} from '../../model/LocalFile.ts';
import {SvgTransform} from '../../SvgTransform.ts';
import {generateDocumentFrontMatter} from './frontmatters/generateDocumentFrontMatter.ts';
import {generateConflictMarkdown} from './frontmatters/generateConflictMarkdown.ts';
import {OdtProcessor} from '../../odt/OdtProcessor.ts';
import {UnMarshaller} from '../../odt/UnMarshaller.ts';
import {DocumentStyles, LIBREOFFICE_CLASSES} from '../../odt/LibreOffice.ts';
import {OdtToMarkdown} from '../../odt/OdtToMarkdown.ts';
import {LocalLinks} from './LocalLinks.ts';
import {SINGLE_THREADED_TRANSFORM} from './QueueTransformer.ts';
import {JobManagerContainer} from '../job/JobManagerContainer.ts';
import {UserConfig} from '../google_folder/UserConfigService.ts';
import type {WorkerResult} from '../../odt/executeOdtToMarkdown.ts';

export function googleMimeToExt(mimeType: string, fileName: string) {
  switch (mimeType) {
    case MimeTypes.APPS_SCRIPT:
      return 'gs';
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/svg+xml':
      return 'svg';
    case 'text/csv':
      return 'csv';
    case 'application/vnd.google-apps.drawing':
      return 'svg';
    case 'application/vnd.google-apps.document':
      return 'odt';
    case 'application/vnd.google-apps.presentation':
      return 'pdf';
    // case 'application/vnd.google-apps.shortcut':
  }

  if (fileName.indexOf('.') > -1) {
    return '';
  }
  return 'bin';
}

export class TaskLocalFileTransform extends QueueTask {
  constructor(protected override logger: winston.Logger,
              private jobManagerContainer: JobManagerContainer,
              private realFileName: string,
              private googleFolder: FileContentService,
              private googleFile: GoogleFile,
              private destinationDirectory: FileContentService,
              private localFile: LocalFile,
              private localLinks: LocalLinks,
              private userConfig: UserConfig,
              private globalHeadersMap: {[key: string]: string},
              private globalInvisibleBookmarks: {[key: string]: number},
              ) {
    super(logger);
    this.retries = 0;

    if (!this.localFile.fileName) {
      throw new Error(`No fileName for: ${this.localFile.id}`);
    }
  }

  override async run(): Promise<QueueTask[]> {
    await this.generate(this.localFile);

    return [];
  }

  async generateBinary(binaryFile: BinaryFile) {
    await new Promise<void>((resolve, reject) => {
      try {
        const dest = this.destinationDirectory.createWriteStream(this.realFileName);

        dest.on('error', err => {
          reject(err);
        });

        const ext = googleMimeToExt(this.googleFile.mimeType, this.googleFile.name);
        const stream = this.googleFolder.createReadStream(`${binaryFile.id}${ext ? '.' + ext : ''}`)
          .on('error', err => {
            reject(err);
          })
          .pipe(dest);

        stream.on('finish', () => {
          resolve();
        });
        stream.on('error', err => {
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  async generateDrawing(drawingFile: DrawingFile) {
    await new Promise<void>((resolve, reject) => {
      try {
        // await this.destinationDirectory.mkdir(getFileDir(targetPath));
        const dest = this.destinationDirectory.createWriteStream(this.realFileName);
        const svgTransform = new SvgTransform(drawingFile.fileName);
        // const svgPath = this.googleScanner.getFilePathPrefix(drawingFile.id) + '.svg';

        dest.on('error', err => {
          reject(err);
        });

        const stream = this.googleFolder.createReadStream(`${drawingFile.id}.svg`)
          .on('error', err => {
            reject(err);
          })
          .pipe(svgTransform)
          .pipe(dest);

        stream.on('finish', () => {
          this.localLinks.append(drawingFile.id, drawingFile.fileName, Array.from(svgTransform.links));
          resolve();
        });
        stream.on('error', err => {
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  async generateDocument(localFile: MdFile) {
    let frontMatter;
    let markdown;
    let headersMap: Record<string, string> = {};
    let invisibleBookmarks: Record<string, number> = {};
    let links = [];
    let errors = [];

    const odtPath = this.googleFolder.getRealPath() + '/' + localFile.id + '.odt';
    const destinationPath = this.destinationDirectory.getRealPath();

    const rewriteRules = this.userConfig.rewrite_rules || [];

    const picturesDirAbsolute = destinationPath + '/' + this.realFileName.replace(/.md$/, '.assets/');

    if (SINGLE_THREADED_TRANSFORM) {
      const processor = new OdtProcessor(true);
      await processor.load(odtPath);
      await processor.unzipAssets(destinationPath, this.realFileName);
      const content = processor.getContentXml();
      const stylesXml = processor.getStylesXml();
      const fileNameMap = processor.getFileNameMap();
      const xmlMap = processor.getXmlMap();

      const parser = new UnMarshaller(LIBREOFFICE_CLASSES, 'DocumentContent');
      const document = parser.unmarshal(content);

      const parserStyles = new UnMarshaller(LIBREOFFICE_CLASSES, 'DocumentStyles');
      const styles: DocumentStyles = parserStyles.unmarshal(stylesXml);
      if (!styles) {
        throw Error('No styles unmarshalled');
      }

      const converter = new OdtToMarkdown(document, styles, fileNameMap, xmlMap);
      converter.setRewriteRules(rewriteRules);
      converter.setPicturesDir('./' + this.realFileName.replace(/.md$/, '.assets/'), picturesDirAbsolute);
      headersMap = converter.getHeadersMap();
      invisibleBookmarks = converter.getInvisibleBookmarks();
      markdown = await converter.convert();
      links = Array.from(converter.links);
      const frontMatterOverload: Record<string, string> = {};
      if (markdown.match(/^ *A. {2}/igm)) {
        frontMatterOverload['markup'] = 'pandoc';
      }
      frontMatter = generateDocumentFrontMatter(localFile, links, this.userConfig.fm_without_version, frontMatterOverload);
      errors = converter.getErrors();
      this.warnings = errors.length;
    } else {


      const workerResult: WorkerResult = <WorkerResult>await this.jobManagerContainer.scheduleWorker('OdtToMarkdown', {
        localFile,
        realFileName: this.realFileName,
        picturesDirAbsolute,
        odtPath,
        destinationPath,
        rewriteRules,
        fm_without_version: this.userConfig.fm_without_version
      });

      links = workerResult.links;
      frontMatter = workerResult.frontMatter;
      markdown = workerResult.markdown;
      errors = workerResult.errors;
      headersMap = workerResult.headersMap;
      invisibleBookmarks = workerResult.invisibleBookmarks;
      this.warnings = errors.length;
    }

    for (const errorMsg of errors) {
      this.logger.warn('Error in: ['+ this.localFile.fileName +'](' + this.localFile.fileName + ') ' + errorMsg, {
        errorMdFile: this.localFile.fileName,
        errorMdMsg: errorMsg
      });
    }

    await this.destinationDirectory.writeFile(this.realFileName, frontMatter + markdown);
    this.localLinks.append(localFile.id, localFile.fileName, links);
    for (const k in headersMap) {
      this.globalHeadersMap['gdoc:' + localFile.id + k] = 'gdoc:' + localFile.id + headersMap[k];
    }
    for (const k in invisibleBookmarks) {
      this.globalInvisibleBookmarks['gdoc:' + localFile.id + k] = invisibleBookmarks[k];
    }
  }

  async generate(localFile: LocalFile): Promise<void> {
    try {
      const verStr = this.localFile.version ? ' #' + this.localFile.version : ' ';
      if (localFile.type === 'conflict') {
        this.logger.info('Transforming conflict: ' + this.localFile.fileName);
        const md = generateConflictMarkdown(localFile);
        await this.destinationDirectory.writeFile(this.realFileName, md);
      } else if (localFile.type === 'redir') { // TODO
        this.logger.info('Transforming redir: ' + this.localFile.fileName);
        // const redirectToFile = this.toGenerate.find(f => f.id === localFile.redirectTo);
        // const redirectToFile = this.generatedScanner.getFileById(localFile.redirectTo);
        // const md = generateRedirectMarkdown(localFile, redirectToFile, this.linkTranslator);
        // await this.destinationDirectory.mkdir(getFileDir(targetPath));
        // await this.destinationDirectory.writeFile(targetPath, md);
        // await this.generatedScanner.update(targetPath, md);
      } else if (localFile.type === 'md') {
        this.logger.info('Transforming markdown: ' + this.localFile.fileName + verStr);
        // const googleFile = await this.googleScanner.getFileById(localFile.id);
        // const downloadFile = await this.downloadFilesStorage.findFile(f => f.id === localFile.id);
        if (this.googleFile) { // && downloadFile
          await this.generateDocument(localFile);
        }
      } else if (localFile.type === 'drawing') {
        this.logger.info('Transforming drawing: ' + this.localFile.fileName + verStr);
        // const googleFile = await this.googleScanner.getFileById(localFile.id);
        // const downloadFile = await this.downloadFilesStorage.findFile(f => f.id === localFile.id);
        if (this.googleFile) { // && downloadFile
          await this.generateDrawing(localFile);
        }
      } else if (localFile.type === 'binary') {
        this.logger.info('Transforming binary: ' + this.localFile.fileName + verStr);
        if (this.googleFile) { // && downloadFile
          await this.generateBinary(localFile);
        }
      }
      this.logger.info('Transformed: ' + this.localFile.fileName + verStr);
    } catch (err: any) {
      this.logger.error('Error transforming ' + localFile.fileName + ' ' + err.stack ? err.stack : err.message);
      throw err;
    }
  }

}
