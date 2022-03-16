import {QueueTask} from '../google_folder/QueueTask';
import winston from 'winston';
import {FileContentService} from '../../utils/FileContentService';
import {GoogleFile} from '../../model/GoogleFile';
import {BinaryFile, DrawingFile, LocalFile, MdFile, RedirFile} from '../../model/LocalFile';
import {SvgTransform} from '../../SvgTransform';
import {NavigationHierarchy} from './generateNavigationHierarchy';
import {generateDocumentFrontMatter} from './frontmatters/generateDocumentFrontMatter';
import {generateConflictMarkdown} from './frontmatters/generateConflictMarkdown';
import {OdtProcessor} from '../../odt/OdtProcessor';
import {UnMarshaller} from '../../odt/UnMarshaller';
import {DocumentStyles, LIBREOFFICE_CLASSES} from '../../odt/LibreOffice';
import {OdtToMarkdown} from '../../odt/OdtToMarkdown';
import {LocalLinks} from './LocalLinks';
import {googleMimeToExt} from '../google_folder/TaskFetchFolder';

export class TaskLocalFileTransform extends QueueTask {
  constructor(protected logger: winston.Logger,
              private realFileName: string,
              private googleFolder: FileContentService,
              private googleFile: GoogleFile,
              private destinationDirectory: FileContentService,
              private localFile: LocalFile,
              private hierarchy: NavigationHierarchy,
              private localLinks: LocalLinks
              ) {
    super(logger);

    if (!this.localFile.fileName) {
      throw new Error(`No fileName for: ${this.localFile.id}`);
    }
  }

  async run(): Promise<QueueTask[]> {
    await this.generate(this.localFile, this.hierarchy);

    return [];
  }

  async generateBinary(binaryFile: BinaryFile) {
    const dest = this.destinationDirectory.createWriteStream(this.realFileName);

    await new Promise<void>((resolve, reject) => {
      dest.on('error', err => {
        reject(err);
      });

      const ext = googleMimeToExt(this.googleFile.mimeType, this.googleFile.name);
      const stream = this.googleFolder.createReadStream(`${binaryFile.id}${ext ? '.' + ext : ''}`)
        .pipe(dest);

      stream.on('finish', () => {
        resolve();
      });
      stream.on('error', err => {
        reject(err);
      });
    });
  }

  async generateDrawing(drawingFile: DrawingFile) {
    // await this.destinationDirectory.mkdir(getFileDir(targetPath));
    const dest = this.destinationDirectory.createWriteStream(this.realFileName);
    const svgTransform = new SvgTransform(drawingFile.fileName);
    // const svgPath = this.googleScanner.getFilePathPrefix(drawingFile.id) + '.svg';

    await new Promise<void>((resolve, reject) => {
      dest.on('error', err => {
        reject(err);
      });

      const stream = this.googleFolder.createReadStream(`${drawingFile.id}.svg`)
        .pipe(svgTransform)
        .pipe(dest);

      stream.on('finish', () => {
        resolve();
      });
      stream.on('error', err => {
        reject(err);
      });
    });
  }

  async generateDocument(localFile: MdFile, googleFile: GoogleFile, hierarchy: NavigationHierarchy) {
    const processor = new OdtProcessor(this.googleFolder, localFile.id);
    await processor.load();
    await processor.unzipAssets(this.destinationDirectory, this.realFileName);

    const content = processor.getContentXml();

    const parser = new UnMarshaller(LIBREOFFICE_CLASSES, 'DocumentContent');
    const document = parser.unmarshal(content);

    const parserStyles = new UnMarshaller(LIBREOFFICE_CLASSES, 'DocumentStyles');
    const styles: DocumentStyles = parserStyles.unmarshal(processor.getStylesXml());
    if (!styles) {
      throw Error('No styles unmarshalled');
    }

    const converter = new OdtToMarkdown(document, styles);
    const markdown = await converter.convert();
    const frontMatter = generateDocumentFrontMatter(localFile, hierarchy, Array.from(converter.links));
    await this.destinationDirectory.writeFile(this.realFileName, frontMatter + markdown);
    await this.destinationDirectory.writeFile(this.realFileName.replace('.md', '.debug.xml'), content);
    this.localLinks.append(localFile.id, Array.from(converter.links));
  }

  async generate(localFile: LocalFile, hierarchy: NavigationHierarchy): Promise<void> {
    this.logger.info('Transforming: ' + this.localFile.fileName);

    if (localFile.type === 'conflict') {
      const conflictingFiles: Array<RedirFile | MdFile> = [];
      const md = generateConflictMarkdown(localFile);
      // await this.destinationDirectory.mkdir(getFileDir(targetPath));
      await this.destinationDirectory.writeFile(this.realFileName, md);
      // await this.generatedScanner.update(targetPath, md);
    } else if (localFile.type === 'redir') { // TODO
      // const redirectToFile = this.toGenerate.find(f => f.id === localFile.redirectTo);
      // const redirectToFile = this.generatedScanner.getFileById(localFile.redirectTo);
      // const md = generateRedirectMarkdown(localFile, redirectToFile, this.linkTranslator);
      // await this.destinationDirectory.mkdir(getFileDir(targetPath));
      // await this.destinationDirectory.writeFile(targetPath, md);
      // await this.generatedScanner.update(targetPath, md);
    } else if (localFile.type === 'md') {
      // const googleFile = await this.googleScanner.getFileById(localFile.id);
      // const downloadFile = await this.downloadFilesStorage.findFile(f => f.id === localFile.id);
      if (this.googleFile) { // && downloadFile
        await this.generateDocument(localFile, this.googleFile, hierarchy);
      }
    } else if (localFile.type === 'drawing') {
      // const googleFile = await this.googleScanner.getFileById(localFile.id);
      // const downloadFile = await this.downloadFilesStorage.findFile(f => f.id === localFile.id);
      if (this.googleFile) { // && downloadFile
        await this.generateDrawing(localFile);
      }
    } else if (localFile.type === 'binary') {
      if (this.googleFile) { // && downloadFile
        await this.generateBinary(localFile);
      }
    }
  }

}
