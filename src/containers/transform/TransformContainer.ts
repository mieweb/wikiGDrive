import winston from 'winston';
import Transport from 'winston-transport';

import {Container, ContainerConfig, ContainerConfigArr, ContainerEngine} from '../../ContainerEngine.ts';
import {FileContentService} from '../../utils/FileContentService.ts';
import {appendConflict, DirectoryScanner, stripConflict} from './DirectoryScanner.ts';
import {GoogleFilesScanner} from './GoogleFilesScanner.ts';
import {convertToRelativeMarkDownPath, convertToRelativeSvgPath} from '../../LinkTranslator.ts';
import {LocalFilesGenerator} from './LocalFilesGenerator.ts';
import {QueueTransformer} from './QueueTransformer.ts';
import {ConflictFile, LocalFile, RedirFile} from '../../model/LocalFile.ts';
import {TaskLocalFileTransform} from './TaskLocalFileTransform.ts';
import {MimeTypes} from '../../model/GoogleFile.ts';
import {generateDirectoryYaml, parseDirectoryYaml} from './frontmatters/generateDirectoryYaml.ts';
import {getContentFileService, removeMarkDownsAndImages} from './utils.ts';
import {LocalLog} from './LocalLog.ts';
import {LocalLinks} from './LocalLinks.ts';
import {TaskRedirFileTransform} from './TaskRedirFileTransform.ts';
import {TocGenerator} from './frontmatters/TocGenerator.ts';
import {FileId} from '../../model/model.ts';
import {MarkdownTreeProcessor} from './MarkdownTreeProcessor.ts';
import {JobManagerContainer} from '../job/JobManagerContainer.ts';
import {UserConfigService} from '../google_folder/UserConfigService.ts';
import {getUrlHash} from '../../utils/idParsers.ts';
import {TaskGoogleMarkdownTransform} from './TaskGoogleMarkdownTransform.ts';
import {frontmatter} from './frontmatters/frontmatter.ts';
import {createIndexer} from '../search/Indexer.ts';

const __filename = import.meta.filename;

function doesExistIn(googleFolderFiles: LocalFile[], localFile: LocalFile) {
  return !!googleFolderFiles.find(file => file.id === localFile.id);
}

interface NameToConflicts {
  [fileName: string]: LocalFile[];
}

export function solveConflicts(filesToGenerate: LocalFile[], destinationFiles: { [realFileName: string]: LocalFile }) {
  const nameToConflictGroups: NameToConflicts = {};
  for (const file of filesToGenerate) {
    if (!nameToConflictGroups[file.fileName]) {
      nameToConflictGroups[file.fileName] = [];
    }
    nameToConflictGroups[file.fileName].push(file);
  }

  const realFileNameToGenerated: { [realFileName: string]: LocalFile } = {};
  for (const fileName in nameToConflictGroups) {
    const group = nameToConflictGroups[fileName];
    if (group.length === 1) {
      realFileNameToGenerated[fileName] = group[0];
    } else {
      const conflictFile: ConflictFile = group[0].type === 'md' ? {
        conflicting: [],
        fileName: fileName,
        id: 'conflict:' + fileName,
        mimeType: MimeTypes.MARKDOWN,
        modifiedTime: new Date().toISOString(),
        title: 'Conflict: ' + group[0].title,
        type: 'conflict'
      } : null;
      if (conflictFile) {
        realFileNameToGenerated[fileName] = conflictFile;
      }

      const conflictsToAssign: LocalFile[] = [];
      for (const fileToGenerate of group) {
        const destinationEntry = Object.entries(destinationFiles).find(f => f[1].id === fileToGenerate.id);
        if (destinationEntry) {
          const realFileName = destinationEntry[0];
          const destinationFile = destinationEntry[1];
          if (stripConflict(realFileName) === fileName) {
            realFileNameToGenerated[realFileName] = destinationFile;
            if (conflictFile) {
              conflictFile.conflicting.push({
                realFileName,
                id: destinationFile.id,
                title: destinationFile.title
              });
            }
            continue;
          }
        }
        conflictsToAssign.push(fileToGenerate);
      }

      let counter = 1;
      for (const destinationFile of conflictsToAssign) {
        let realFileName = appendConflict(destinationFile.fileName, counter++);
        while (realFileNameToGenerated[realFileName]) {
          realFileName = appendConflict(destinationFile.fileName, counter++);
        }
        realFileNameToGenerated[realFileName] = destinationFile;
        if (conflictFile) {
          conflictFile.conflicting.push({
            realFileName,
            id: destinationFile.id,
            title: destinationFile.title
          });
        }
      }
    }
  }

  return realFileNameToGenerated;
}

function processLogExisting(realFileName: string, fileToGenerate: LocalFile, destinationFiles: { [realFileName: string]: LocalFile }, localLog: LocalLog, prefix: string) {
  const destinationEntry = Object.entries(destinationFiles).find(item => item[1].id === fileToGenerate.id);
  if (destinationEntry) {
    if (destinationEntry[0] !== realFileName) {
      localLog.append({
        filePath: prefix + realFileName,
        id: fileToGenerate.id,
        type: fileToGenerate.type,
        event: 'renamed',
      });
    } else {
      localLog.append({
        filePath: prefix + realFileName,
        id: fileToGenerate.id,
        type: fileToGenerate.type,
        event: 'touched',
      });
    }
  } else {
    localLog.append({
      filePath: prefix + realFileName,
      id: fileToGenerate.id,
      type: fileToGenerate.type,
      event: 'created',
    });
  }
}

function processLogRemoved(realFileName: string, destinationFiles: { [realFileName: string]: LocalFile }, localLog: LocalLog, prefix: string) {
  const destinationFile = destinationFiles[realFileName];
  const entryToGenerate = Object.entries(destinationFiles).find(item => item[1].id === destinationFile.id);
  if (!entryToGenerate) {
    localLog.append({
      filePath: prefix + realFileName,
      id: destinationFile.id,
      type: destinationFile.type,
      event: 'removed',
    });
  }
}

async function addBinaryMetaData(destinationFiles: { [realFileName: string]: LocalFile }, destinationDirectory: FileContentService) {
  const yamlContent = await destinationDirectory.exists('.wgd-directory.yaml') ?
    await destinationDirectory.readFile('.wgd-directory.yaml') : '';
  const props = parseDirectoryYaml(yamlContent);
  const map = props?.fileMap || {};
  for (const realFileName in destinationFiles) {
    const destinationFile = destinationFiles[realFileName];
    if (destinationFile.id !== 'TO_FILL') {
      continue;
    }

    const mapData = map[realFileName];
    if (!mapData) {
      continue;
    }

    destinationFile.fileName = mapData.fileName;
    destinationFile.id = mapData.id;
    destinationFile.modifiedTime = mapData.modifiedTime;
  }
}

export class TransformLog extends Transport {
  public errors = {};

  constructor(options = {}) {
    super(options);
  }

  log(info: { level: string, errorMdFile: string, errorMdMsg: string }, next: () => void) {
    switch (info.level) {
      case 'error':
      case 'warn':
        if (info.errorMdFile) {
          if (!this.errors[info.errorMdFile]) {
            this.errors[info.errorMdFile] = [];
          }
          if (info.errorMdMsg) {
            this.errors[info.errorMdFile].push(info.errorMdMsg);
          }
        }
    }

    if (next) {
      next();
    }
  }
}

export class TransformContainer extends Container {
  private logger: winston.Logger;
  private generatedFileService: FileContentService;
  private localLog: LocalLog;
  private localLinks: LocalLinks;
  private filterFilesIds: FileId[];
  private userConfigService: UserConfigService;

  private progressNotifyCallback: ({total, completed, warnings, failed}: { total?: number; completed?: number; warnings?: number; failed?: number }) => void;
  private transformLog: TransformLog;
  private isFailed = false;
  private useGoogleMarkdowns = false;
  private globalHeadersMap: {[key: string]: string} = {};
  private globalInvisibleBookmarks: {[key: string]: number} = {};

  constructor(public readonly params: ContainerConfig, public readonly paramsArr: ContainerConfigArr = {}) {
    super(params, paramsArr);
    this.filterFilesIds = paramsArr['filesIds'] || [];
  }

  async mount2(fileService: FileContentService, destFileService: FileContentService): Promise<void> {
    this.filesService = fileService;
    this.generatedFileService = destFileService;
    this.userConfigService = new UserConfigService(this.filesService);
    await this.userConfigService.load();
  }

  async init(engine: ContainerEngine): Promise<void> {
    await super.init(engine);
    this.logger = engine.logger.child({ filename: __filename, driveId: this.params.folderId, jobId: this.params.jobId });
    this.transformLog = new TransformLog();
    this.logger.add(this.transformLog);
  }

  async syncDir(googleFolder: FileContentService, destinationDirectory: FileContentService, queueTransformer: QueueTransformer) {
    const googleScanner = new GoogleFilesScanner();
    if (!await googleFolder.exists('.folder.json')) {
      return;
    }
    const googleFolderData = await googleFolder.readJson('.folder.json') || {};

    const googleFolderFiles = await googleScanner.scan(googleFolder);

    const destinationScanner = new DirectoryScanner();
    const destinationFiles = await destinationScanner.scan(destinationDirectory);
    await addBinaryMetaData(destinationFiles, destinationDirectory);

    const localFilesGenerator = new LocalFilesGenerator();
    const filesToGenerate: LocalFile[] = await localFilesGenerator.generateLocalFiles(googleFolderFiles);

    const realFileNameToGenerated = solveConflicts(filesToGenerate, destinationFiles);

    for (const realFileName in destinationFiles) {
      if (realFileName.startsWith('.')) {
        continue;
      }
      processLogRemoved(realFileName, destinationFiles, this.localLog, destinationDirectory.getVirtualPath());

      const fileInDirectory = destinationFiles[realFileName];

      if (!doesExistIn(filesToGenerate, fileInDirectory)) {
        await removeMarkDownsAndImages(realFileName, destinationDirectory);
      }
      if (fileInDirectory.type === 'redir' || fileInDirectory.type === 'conflict') {
        await removeMarkDownsAndImages(realFileName, destinationDirectory);
      }
      if (!realFileNameToGenerated[realFileName]) {
        await removeMarkDownsAndImages(realFileName, destinationDirectory);
      }
    }

    for (const realFileName in realFileNameToGenerated) {
      const localFile: LocalFile = realFileNameToGenerated[realFileName];
      processLogExisting(realFileName, localFile, destinationFiles, this.localLog, destinationDirectory.getVirtualPath());

      if (localFile.type === 'directory') {
        await destinationDirectory.mkdir(realFileName);
        const googleFolderFile = googleFolderFiles.find(f => f.id === localFile.id);
        if (googleFolderFile) {
          const googleSubFolder = await googleFolder.getSubFileService(googleFolderFile.id);
          await this.syncDir(googleSubFolder, await destinationDirectory.getSubFileService(realFileName), queueTransformer);
        }
        continue;
      }

      const googleFile = googleFolderFiles.find(f => f.id === localFile.id);

      if (this.filterFilesIds.length > 0 && -1 === this.filterFilesIds.indexOf(localFile.id)) {
        continue;
      }

      const jobManagerContainer = <JobManagerContainer>this.engine.getContainer('job_manager');

      if (!this.useGoogleMarkdowns) {
        const task = new TaskLocalFileTransform(
          this.logger,
          jobManagerContainer,
          realFileName,
          googleFolder,
          googleFile,
          destinationDirectory,
          localFile,
          this.localLinks,
          this.userConfigService.config,
          this.globalHeadersMap,
          this.globalInvisibleBookmarks
        );
        queueTransformer.addTask(task);
      } else {
        const task = new TaskGoogleMarkdownTransform(
          this.logger,
          jobManagerContainer,
          realFileName,
          googleFolder,
          googleFile,
          destinationDirectory,
          localFile,
          this.localLinks,
          this.userConfigService.config
        );
        queueTransformer.addTask(task);
      }
    }

    const dirNames = destinationDirectory.getVirtualPath().replace(/\/$/, '').split('/');
    const yaml = generateDirectoryYaml(stripConflict(dirNames[dirNames.length - 1]), googleFolderData, realFileNameToGenerated);
    await destinationDirectory.writeFile('.wgd-directory.yaml', yaml);
  }

  async run(rootFolderId: FileId) {
    if (!(this.userConfigService.config.transform_subdir || '').startsWith('/')) {
      this.logger.warn('Content subdirectory must be set and start with /');
      return;
    }
    const contentFileService = await getContentFileService(this.generatedFileService, this.userConfigService);

    const queueTransformer = new QueueTransformer(this.logger);
    queueTransformer.onProgressNotify(({ total, completed, warnings, failed }) => {
      if (failed > 0) {
        this.isFailed = true;
      }
      if (this.progressNotifyCallback) {
        this.progressNotifyCallback({ total, completed, warnings, failed });
      }
    });

    this.logger.info('Start transforming: ' + rootFolderId);
    this.localLog = new LocalLog(contentFileService);
    await this.localLog.load();
    this.localLinks = new LocalLinks(contentFileService);
    await this.localLinks.load();

    const processed = new Set<string>();
    const previouslyFailed = new Set<string>();

    let retry = true;
    while (retry) {
      retry = false;
      await this.syncDir(this.filesService, contentFileService, queueTransformer);
      await queueTransformer.finished();
      if (this.filterFilesIds.length > 0) {
        const filterFilesIds = new Set<string>();
        for (const fileId of this.filterFilesIds) {
          processed.add(fileId);
          const backLinks = this.localLinks.getBackLinks(fileId);
          for (const backLink of backLinks) {
            if (processed.has(backLink.fileId)) {
              continue;
            }
            filterFilesIds.add(backLink.fileId);
          }
        }
        if (filterFilesIds.size > 0) {
          if (previouslyFailed.size === filterFilesIds.size) {
            let shouldBreak = true;
            for (const fileId of previouslyFailed) {
              if (filterFilesIds.has(fileId)) {
                shouldBreak = false;
                break;
              }
            }
            if (shouldBreak) {
              break;
            }
          }

          this.filterFilesIds = Array.from(filterFilesIds);
          previouslyFailed.clear();
          for (const fileId of filterFilesIds) {
            previouslyFailed.add(fileId);
          }
          retry = true;
        }
      }
    }

    await queueTransformer.finished();

    await contentFileService.remove('_errors.md');
    if (Object.keys(this.transformLog.errors).length > 0) {
      let errorLog = '';
      errorLog += '---\n';
      errorLog += 'type: \'page\'\n';
      errorLog += '---\n';
      for (const mdFile in this.transformLog.errors) {
        errorLog += `\n* [${mdFile}](${mdFile})\n`;
        for (const mdMsg of this.transformLog.errors[mdFile]) {
          errorLog += `   ${mdMsg}\n`;
        }
      }
      await contentFileService.writeFile('_errors.md', errorLog);
    }

    await this.createRedirs(contentFileService);
    await this.writeToc(contentFileService);
    await this.rewriteLinks(contentFileService);

    await this.localLog.save();
    await this.localLinks.save();

    this.logger.info('Regenerate tree: ' + rootFolderId + ` to: ${contentFileService.getRealPath()}/.tree.json`);

    const indexer = await createIndexer();

    const markdownTreeProcessor = new MarkdownTreeProcessor(contentFileService);
    await markdownTreeProcessor.regenerateTree(rootFolderId, indexer);
    await markdownTreeProcessor.save();

    await this.generatedFileService.mkdir('/.private');
    await this.generatedFileService.writeBuffer('/.private/' + indexer.getFileName(), await indexer.getData());
  }

  public failed() {
    return this.isFailed;
  }

  async rewriteLinks(destinationDirectory: FileContentService) {
    const files = await destinationDirectory.list();

    for (const fileName of files) {
      if (await destinationDirectory.isDirectory(fileName)) {
        await this.rewriteLinks(await destinationDirectory.getSubFileService(fileName));
        continue;
      }

      if (fileName.endsWith('.md') || fileName.endsWith('.svg')) {
        const content = await destinationDirectory.readFile(fileName);

        const parsed = frontmatter(content);
        const props = parsed.data;
        let newContent = content;
        if (props?.id) {
          newContent = newContent.replace(/\n? ?<a id="([^"]*)"><\/a>\n?/igm, (str: string, hash: string) => {
            const fullLink = 'gdoc:' + props.id + '#' + hash;
            if (this.globalInvisibleBookmarks[fullLink]) {
              const retVal = str.replace(`<a id="${hash}"></a>`, '');
              if (retVal === '\n \n') {
                return '\n';
              }
              if (retVal === '\n\n') {
                return '\n';
              }
              if (retVal.endsWith(' \n')) {
                return retVal.substring(0, retVal.length - 2) + '\n';
              }
              if (retVal.startsWith('\n ')) {
                return '\n' + retVal.substring(1);
              }
              if (retVal === ' ') {
                return '';
              }
              return retVal;
            } else {
              this.logger.warn(`In ${fileName} there is a link to ${fullLink} which can't be translated into bookmark link`);
            }
            return str;
          });
        }

        newContent = newContent.replace(/(gdoc:[A-Z0-9_-]+)(#[^'")\s]*)?/ig, (str: string) => {
          let fileId = str.substring('gdoc:'.length).replace(/#.*/, '');
          let hash = getUrlHash(str) || '';
          if (hash) {
            if (this.globalHeadersMap[str]) {
              const idx = this.globalHeadersMap[str].indexOf('#');
              if (idx >= 0) {
                fileId = this.globalHeadersMap[str].substring('gdoc:'.length, idx);
                hash = this.globalHeadersMap[str].substring(idx);
              }
            } else {
              const fullLink = str;
              this.logger.warn(`In ${fileName} there is a link to ${fullLink} which can't be translated into bookmark link`);
            }
          }
          const lastLog = this.localLog.findLastFile(fileId);
          if (lastLog && lastLog.event !== 'removed') {
            if (fileName.endsWith('.svg')) {
              return convertToRelativeSvgPath(lastLog.filePath, destinationDirectory.getVirtualPath() + fileName);
            } else {
              return convertToRelativeMarkDownPath(lastLog.filePath, destinationDirectory.getVirtualPath() + fileName) + hash;
            }
          } else {
            return 'https://drive.google.com/open?id=' + fileId + hash.replace('#_', '#heading=h.');
          }
        });
        if (content !== newContent) {
          await destinationDirectory.writeFile(fileName, newContent);
        }
      }
    }
  }

  async createRedirs(contentFileService: FileContentService) {
    const rows = this.localLog.getLogs();

    const markDownScanner = new DirectoryScanner();
    const transformerQueue = new QueueTransformer(this.logger);
    transformerQueue.onProgressNotify(({ total, completed, warnings, failed }) => {
      if (this.progressNotifyCallback) {
        this.progressNotifyCallback({ total, completed, warnings, failed });
      }
    });

    for (let rowNo = rows.length - 1; rowNo >= 0; rowNo--) {
      const row = rows[rowNo];
      if (row.type === 'md' && !await contentFileService.exists(row.filePath)) {
        const lastLog = this.localLog.findLastFile(row.id);
        if (lastLog) {
          const parts = row.filePath.split('/');
          const fileName = parts.pop();
          const dirName = parts.join('/');

          if (!await contentFileService.exists(lastLog.filePath)) {
            continue;
          }
          const localFileContent = await contentFileService.readFile(lastLog.filePath);
          const localFile = markDownScanner.parseMarkdown(localFileContent, lastLog.filePath);
          if (!localFile) {
            continue;
          }

          const lastLogRedir = this.localLog.findLastFileByPath(dirName ? dirName + '/' + fileName : fileName);
          if (lastLogRedir?.event === 'removed') {
            continue;
          }

          const redirFile: RedirFile = {
            type: 'redir',
            fileName,
            id: row.id,
            mimeType: MimeTypes.MARKDOWN,
            modifiedTime: new Date(row.mtime).toISOString(),
            redirectTo: lastLog.id,
            title: 'Redirect to: ' + localFile.title,
          };

          const task = new TaskRedirFileTransform(
            this.logger,
            fileName,
            dirName ? await contentFileService.getSubFileService(dirName) : contentFileService,
            redirFile,
            localFile
          );
          transformerQueue.addTask(task);
        }
      }
    }

    await transformerQueue.finished();
  }

  async writeToc(contentFileService: FileContentService) {
    const tocGenerator = new TocGenerator();
    const md = await tocGenerator.generate(contentFileService);
    await contentFileService.writeFile('toc.md', md);
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async destroy(): Promise<void> {
  }

  onProgressNotify(callback: ({total, completed, warnings, failed}: { total?: number; completed?: number, warnings?: number, failed?: number }) => void) {
    this.progressNotifyCallback = callback;
  }

  setUseGoogleMarkdowns(value: boolean) {
    this.useGoogleMarkdowns = value;
  }
}
