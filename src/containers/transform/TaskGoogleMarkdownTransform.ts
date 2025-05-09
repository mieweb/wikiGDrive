import fs from 'node:fs';
import winston from 'winston';

import {QueueTask} from '../google_folder/QueueTask.ts';
import {JobManagerContainer} from '../job/JobManagerContainer.ts';
import {FileContentService} from '../../utils/FileContentService.ts';
import {GoogleFile} from '../../model/GoogleFile.ts';
import {BinaryFile, DrawingFile, LocalFile, MdFile} from '../../model/LocalFile.ts';
import {LocalLinks} from './LocalLinks.ts';
import {UserConfig} from '../google_folder/UserConfigService.ts';
import {SvgTransform} from '../../SvgTransform.ts';
import {generateDocumentFrontMatter} from './frontmatters/generateDocumentFrontMatter.ts';
import {generateConflictMarkdown} from './frontmatters/generateConflictMarkdown.ts';
import {googleMimeToExt} from './TaskLocalFileTransform.ts';
import {getUrlHash, urlToFolderId} from '../../utils/idParsers.ts';
import { Buffer } from "node:buffer";

export class TaskGoogleMarkdownTransform extends QueueTask {
  constructor(protected logger: winston.Logger,
              private jobManagerContainer: JobManagerContainer,
              private realFileName: string,
              private googleFolder: FileContentService,
              private googleFile: GoogleFile,
              private destinationDirectory: FileContentService,
              private localFile: LocalFile,
              private localLinks: LocalLinks,
              private userConfig: UserConfig
  ) {
    super(logger);
    this.retries = 0;

    if (!this.localFile.fileName) {
      throw new Error(`No fileName for: ${this.localFile.id}`);
    }
  }

  async run(): Promise<QueueTask[]> {
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
    const links = new Set<string>();

    const mdPath = this.googleFolder.getRealPath() + '/' + localFile.id + '.md';

    const input: Buffer = fs.readFileSync(mdPath);

    const originalMarkdown = new TextDecoder().decode(input);

    const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+?)\)/g;

    function replaceMarkdownLinks(markdown, replacerFunction) {
      return markdown.replace(markdownLinkRegex, (match, linkText, url) => {
        // Call the replacer function with the link text, URL, and title
        return replacerFunction(linkText, url);
      });
    }

    function customReplacer(linkText, href) {
      href = href.replaceAll('\\', '');

      const id = urlToFolderId(href);
      const hash = getUrlHash(href);
      if (id) {
        href = 'gdoc:' + id + hash;
      }
      if (href && !href.startsWith('#') && href.indexOf(':') > -1) {
        links.add(href);
      }

      return `[${linkText}](${href})`;
    }

    const markdownRewrittenLinks = replaceMarkdownLinks(originalMarkdown, customReplacer);

    const pattern = /\*\{\{%\s+.*?\s+%\}\}\*/g;

    const markdown = markdownRewrittenLinks.replace(pattern, (match) => {
      // Remove the surrounding asterisks
      return match.slice(1, -1);
    });

    const frontMatterOverload: Record<string, string> = {};
    if (markdown.match(/^ *A. {2}/igm)) {
      frontMatterOverload['markup'] = 'pandoc';
    }

    // links = Array.from(converter.links);
    const frontMatter = generateDocumentFrontMatter(localFile, Array.from(links), this.userConfig.fm_without_version, frontMatterOverload);
    const errors = [];
    this.warnings = errors.length;

    for (const errorMsg of errors) {
      this.logger.warn('Error in: ['+ this.localFile.fileName +'](' + this.localFile.fileName + ') ' + errorMsg, {
        errorMdFile: this.localFile.fileName,
        errorMdMsg: errorMsg
      });
    }

    await this.destinationDirectory.writeFile(this.realFileName, frontMatter + markdown);
    this.localLinks.append(localFile.id, localFile.fileName, Array.from(links));
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
    } catch (err) {
      this.logger.error('Error transforming ' + localFile.fileName + ' ' + err.stack ? err.stack : err.message);
      throw err;
    }
  }

}
