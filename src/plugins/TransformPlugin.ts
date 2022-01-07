'use strict';

import * as path from 'path';
import * as fs from 'fs';

import {BasePlugin} from './BasePlugin';
import {GoogleFile, GoogleFilesStorage, MimeTypes} from '../storage/GoogleFilesStorage';
import {DownloadFilesStorage} from '../storage/DownloadFilesStorage';
import {isConflict, isRedirect, LocalFile, LocalFilesStorage, TransformHandler} from '../storage/LocalFilesStorage';
import {urlToFolderId} from '../utils/idParsers';
import {DriveConfig} from './StoragePlugin';
import {LocalPathGenerator} from '../storage/LocalPathGenerator';
import {ImageUnZipper} from '../utils/ImageUnZipper';
import {generateConflictMarkdown} from '../markdown/generateConflictMarkdown';
import {generateRedirectMarkdown} from '../markdown/generateRedirectMarkdown';
import {LinkTranslator} from '../LinkTranslator';
import {SvgTransform} from '../SvgTransform';
import {GoogleListFixer} from '../html/GoogleListFixer';
import {UnZipper} from '../utils/UnZipper';
import {EmbedImageFixer} from '../html/EmbedImageFixer';
import {JsonToMarkdown} from '../markdown/JsonToMarkdown';
import {generateDocumentFrontMatter} from '../markdown/generateDocumentFrontMatter';
import {generateNavigationHierarchy, NavigationHierarchy} from '../generateNavigationHierarchy';
import {LinkRewriter} from '../markdown/LinkRewriter';
import {TocGenerator} from '../TocGenerator';
import {queue} from 'async';

async function ensureDir(filePath) {
  const parts = filePath.split(path.sep);
  if (parts.length < 2) {
    return;
  }
  parts.pop();

  if (!fs.existsSync(parts.join(path.sep))) {
    fs.mkdirSync(parts.join(path.sep), { recursive: true });
  }
}

async function loadJson(filePath: string) {
  const str = fs.readFileSync(filePath).toString('utf-8');
  return JSON.parse(str);
}

export class TransformPlugin extends BasePlugin implements TransformHandler {
  private googleFilesStorage: GoogleFilesStorage;
  private downloadFilesStorage: DownloadFilesStorage;
  private localFilesStorage: LocalFilesStorage;
  private handlingFiles = false;
  private drive_config: DriveConfig;
  private config_dir: any;
  private toGenerate: string[] = [];
  private googleFileIds: string[];
  private oldTocMd;

  private progress: {
    failed: number;
    completed: number;
    total: number;
  };
  private linkTranslator: LinkTranslator;

  constructor(eventBus, logger) {
    super(eventBus, logger.child({filename: __filename}));

    this.googleFileIds = [];

    eventBus.on('main:set_google_file_ids_filter', (googleFileIds) => {
      this.googleFileIds = googleFileIds;
    });
    eventBus.on('main:run', async (params) => {
      this.config_dir = params.config_dir;
    });
    eventBus.on('drive_config:loaded', (drive_config) => {
      this.drive_config = drive_config;
    });
    eventBus.on('google_files:initialized', ({googleFilesStorage}) => {
      this.googleFilesStorage = googleFilesStorage;
    });
    eventBus.on('download_files:initialized', ({downloadFilesStorage}) => {
      this.downloadFilesStorage = downloadFilesStorage;
    });
    eventBus.on('local_files:initialized', ({localFilesStorage}) => {
      this.localFilesStorage = localFilesStorage;
    });

    eventBus.on('transform:run', async () => {
      await this.start();
    });
  }

  private async start() {
    if (this.handlingFiles) {
      return;
    }
    this.handlingFiles = true;

    this.linkTranslator = new LinkTranslator(this.localFilesStorage);
    if (this.config_dir.link_mode) {
      this.linkTranslator.setMode(this.config_dir.link_mode);
    }

    const googleFiles: GoogleFile[] = this.googleFilesStorage.findFiles(() => true);

    const rootFolderId = urlToFolderId(this.drive_config['drive']);

    const localPathGenerator = new LocalPathGenerator(this.drive_config.flat_folder_structure);
    const localFiles = await localPathGenerator.generateDesiredPaths(rootFolderId, googleFiles);

    this.toGenerate = [];

    this.progress = {
      total: 0,
      completed: 0,
      failed: 0
    };
    this.eventBus.emit('transform:progress', this.progress);

    await this.localFilesStorage.commit(localFiles, this);

    this.eventBus.emit('transform:done', this.progress);

    this.handlingFiles = false;
  }

  async beforeSave() {
    let hierarchy: NavigationHierarchy = {};

    const navigationFile = this.localFilesStorage.findFile(file => file.name === '.navigation');
    if (navigationFile) {
      const navPath = path.join(this.config_dir, 'files', navigationFile.id + '.gdoc');
      if (fs.existsSync(navPath)) {
        const navDoc = await loadJson(navPath);
        const linkRewriter = new LinkRewriter(navDoc, this.linkTranslator, '/.navigation');
        await linkRewriter.process();

        const files = this.localFilesStorage.findFiles(file => !!file);
        hierarchy = await generateNavigationHierarchy(navDoc, files, this.logger);
      }
    }

    let toGenerate = this.toGenerate;
    if (this.googleFileIds.length > 0) {
      toGenerate = this.googleFileIds;
    }

    this.progress.total = toGenerate.length;
    this.eventBus.emit('transform:progress', this.progress);

    const CONCURRENCY = 4;

    const q = queue<LocalFile>(async (localFile, callback) => {
      try {
        if (localFile) {
          await this.generate(localFile, hierarchy);
        }
        this.progress.completed++;
        this.eventBus.emit('transform:progress', this.progress);
        callback();
      } catch (err) {
        callback(err);
      }
    }, CONCURRENCY);

    q.error(async (error, file) => {
      this.logger.error(error);
    });

    if (toGenerate.length > 0) {
      for (const id of toGenerate) {
        const localFile = this.localFilesStorage.findFile(f => f.id === id);
        q.push(localFile);
      }
      await q.drain();
    }

    if (this.googleFileIds.length > 0) {
      return false;
    }

    await this.writeToc();

    return true;
  }

  async writeToc() {
    const targetPath = path.join(this.drive_config.dest, 'toc.md');
    const tocGenerator = new TocGenerator('toc.md', this.linkTranslator, this.localFilesStorage);
    const md = await tocGenerator.generate();

    if (this.oldTocMd !== md) {
      fs.writeFileSync(targetPath, md);
      this.oldTocMd = md;
    }
  }

  async removeMarkDownsAndImages(file: LocalFile): Promise<void> {
    if (!file || !file.localPath) return;

    const removePath = path.join(this.drive_config.dest, ...file.localPath.substr(1).split('/'));
    if (fs.existsSync(removePath)) {
      const stat = fs.statSync(removePath);
      if (stat.isDirectory()) {
        const files = fs.readdirSync(removePath);
        for (const file of files) {
          if (file.endsWith('.png')) {
            fs.unlinkSync(path.join(removePath, file));
          }
        }
      } else {
        fs.unlinkSync(removePath);

        if (removePath.endsWith('.md')) {
          const imagesPath = removePath.replace(/.md$/, '.images');
          if (fs.existsSync(imagesPath)) {
            fs.rmdirSync(imagesPath, {recursive: true});
          }
        }
      }
    }
  }

  async forceGeneration(localFile: LocalFile): Promise<void> {
    this.toGenerate.push(localFile.id);
  }

  async generate(localFile: LocalFile, hierarchy: NavigationHierarchy): Promise<void> {
    const targetPath = path.join(this.drive_config.dest, ...localFile.localPath.substr(1).split('/'));
    const targetSubPath = path.join(...localFile.localPath.substr(1).split('/'));
    if (isConflict(localFile)) {
      const conflicting = localFile.conflicting.map(id => this.localFilesStorage.findFile(f => f.id === id));
      const md = await generateConflictMarkdown(localFile, conflicting);
      await ensureDir(targetPath);
      fs.writeFileSync(targetPath, md);
    } else if (isRedirect(localFile)) {

      const md = await generateRedirectMarkdown(localFile, this.localFilesStorage.findFile(f => f.id === localFile.redirectTo), this.linkTranslator);
      await ensureDir(targetPath);
      fs.writeFileSync(targetPath, md);

    } else {
      const googleFile = await this.googleFilesStorage.findFile(f => f.id === localFile.id);
      const downloadFile = await this.downloadFilesStorage.findFile(f => f.id === localFile.id);
      if (googleFile && downloadFile) {
        switch (googleFile.mimeType) {
          case MimeTypes.DRAWING_MIME: {
            await ensureDir(targetPath);
            const dest = fs.createWriteStream(targetPath);
            const svgTransform = new SvgTransform(localFile.localPath, this.linkTranslator);
            const svgPath = path.join(this.config_dir, 'files', localFile.id + '.svg');

            await new Promise<void>((resolve, reject) => {
              dest.on('error', err => {
                reject(err);
              });

              const stream = fs.createReadStream(svgPath)
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
            break;

          case MimeTypes.DOCUMENT_MIME: {
            const zipPath = path.join(this.config_dir, 'files', localFile.id + '.zip');
            const zipBuffer = fs.readFileSync(zipPath);

            if (downloadFile.images?.length > 0) {
              const imagesDirPath = targetPath.replace(/.md$/, '.images/');
              const imageUnZipper = new ImageUnZipper();
              if (!fs.existsSync(imagesDirPath)) {
                fs.mkdirSync(imagesDirPath, {recursive: true});
              }
              await imageUnZipper.unpack(zipBuffer, imagesDirPath);
            }

            const gdoc = await loadJson(path.join(this.config_dir, 'files', localFile.id + '.gdoc'));

            const unZipper = new UnZipper();
            await unZipper.load(zipBuffer);
            const googleListFixer = new GoogleListFixer(unZipper.getHtml());
            const embedImageFixer = new EmbedImageFixer(this.downloadFilesStorage, this.localFilesStorage, downloadFile.images, targetSubPath.replace(/.md$/, '.images/'));
            const linkRewriter = new LinkRewriter(gdoc, this.linkTranslator, localFile.localPath);

            await googleListFixer.process(gdoc);
            await embedImageFixer.process(gdoc);
            await linkRewriter.process();

            const jsonToMarkdown = new JsonToMarkdown(gdoc);
            const md = await jsonToMarkdown.convert();

            const frontMatter = generateDocumentFrontMatter(googleFile, localFile, this.linkTranslator, hierarchy);

            await ensureDir(targetPath);
            fs.writeFileSync(targetPath, frontMatter + md);
          }
            break;
        }
      }
    }
  }
}
