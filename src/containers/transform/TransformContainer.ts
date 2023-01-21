import winston from 'winston';
import {Container, ContainerConfig, ContainerConfigArr, ContainerEngine} from '../../ContainerEngine';
import {FileContentService} from '../../utils/FileContentService';
import {appendConflict, DirectoryScanner, RESERVED_NAMES, stripConflict} from './DirectoryScanner';
import {GoogleFilesScanner} from './GoogleFilesScanner';
import {convertToRelativeMarkDownPath, convertToRelativeSvgPath} from '../../LinkTranslator';
import {LocalFilesGenerator} from './LocalFilesGenerator';
import {QueueTransformer} from './QueueTransformer';
import {generateNavigationHierarchy, NavigationHierarchy} from './generateNavigationHierarchy';
import {ConflictFile, LocalFile, RedirFile} from '../../model/LocalFile';
import {TaskLocalFileTransform} from './TaskLocalFileTransform';
import {GoogleFile, MimeTypes} from '../../model/GoogleFile';
import {generateDirectoryYaml, parseDirectoryYaml} from './frontmatters/generateDirectoryYaml';
import {removeMarkDownsAndImages} from './utils';
import {LocalLog} from './LocalLog';
import {LocalLinks} from './LocalLinks';
import {OdtProcessor} from '../../odt/OdtProcessor';
import {UnMarshaller} from '../../odt/UnMarshaller';
import {DocumentContent, LIBREOFFICE_CLASSES} from '../../odt/LibreOffice';
import {TaskRedirFileTransform} from './TaskRedirFileTransform';
import {TocGenerator} from './frontmatters/TocGenerator';
import {FileId} from '../../model/model';
import {fileURLToPath} from 'url';
import {MarkdownTreeProcessor} from './MarkdownTreeProcessor';
import {LunrIndexer} from '../search/LunrIndexer';
import {JobManagerContainer} from '../job/JobManagerContainer';
import {UserConfigService} from '../google_folder/UserConfigService';
import Transport from 'winston-transport';

const __filename = fileURLToPath(import.meta.url);

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

  log(info, callback) {
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

    if (callback) {
      callback(null, true);
    }
  }
}

export class TransformContainer extends Container {
  private logger: winston.Logger;
  private generatedFileService: FileContentService;
  private hierarchy: NavigationHierarchy = {};
  private localLog: LocalLog;
  private localLinks: LocalLinks;
  private filterFilesIds: FileId[];
  private transformSubDir: string;
  private userConfigService: UserConfigService;

  private progressNotifyCallback: ({total, completed}: { total?: number; completed?: number }) => void;
  private transformLog: TransformLog;

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
    this.logger = engine.logger.child({ filename: __filename, driveId: this.params.name });
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

      const task = new TaskLocalFileTransform(
        this.logger,
        jobManagerContainer,
        realFileName,
        googleFolder,
        googleFile,
        destinationDirectory,
        localFile,
        this.hierarchy,
        this.localLinks,
        this.userConfigService.config
      );
      queueTransformer.addTask(task);
    }

    const dirNames = destinationDirectory.getVirtualPath().replace(/\/$/, '').split('/');
    const yaml = generateDirectoryYaml(stripConflict(dirNames[dirNames.length - 1]), googleFolderData, realFileNameToGenerated);
    await destinationDirectory.writeFile('.wgd-directory.yaml', yaml);
  }

  async run(rootFolderId: FileId) {
    const contentFileService = this.transformSubDir ? await this.generatedFileService.getSubFileService(this.transformSubDir, '/') : this.generatedFileService;

    const queueTransformer = new QueueTransformer(this.logger);
    queueTransformer.onProgressNotify(({ total, completed }) => {
      if (this.progressNotifyCallback) {
        this.progressNotifyCallback({ total, completed });
      }
    });

    this.logger.info('Start transforming: ' + rootFolderId);
    this.localLog = new LocalLog(contentFileService);
    await this.localLog.load();
    this.localLinks = new LocalLinks(contentFileService);
    await this.localLinks.load();

    this.hierarchy = await this.loadNavigationHierarchy();

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
            if (processed.has(backLink)) {
              continue;
            }
            filterFilesIds.add(backLink);
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
      console.log('this.transformLog.errors', this.transformLog.errors);
      let errorLog = '';
      errorLog += '---\n';
      errorLog += 'type: \'page\'\n';
      errorLog += '---\n';
      for (const mdFile in this.transformLog.errors) {
        errorLog += `\n**[${mdFile}](${mdFile})**\n\n`;
        for (const mdMsg of this.transformLog.errors[mdFile]) {
          errorLog += `${mdMsg}\n`;
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

    const markdownTreeProcessor = new MarkdownTreeProcessor(contentFileService);
    await markdownTreeProcessor.regenerateTree(rootFolderId);
    await markdownTreeProcessor.save();

    const indexer = new LunrIndexer();
    await markdownTreeProcessor.walkTree((page) => {
      indexer.addPage(page);
      return false;
    });
    await this.generatedFileService.mkdir('/.private');
    await this.generatedFileService.writeJson('/.private/lunr.json', indexer.getJson());
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
        const newContent = content.replace(/(gdoc:[A-Z0-9_-]+)/ig, (str: string) => {
          const fileId = str.substring('gdoc:'.length);
          const lastLog = this.localLog.findLastFile(fileId);
          if (lastLog) {
            if (fileName.endsWith('.svg')) {
              return convertToRelativeSvgPath(lastLog.filePath, destinationDirectory.getVirtualPath() + fileName);
            } else {
              return convertToRelativeMarkDownPath(lastLog.filePath, destinationDirectory.getVirtualPath() + fileName);
            }
          } else {
            return 'https://drive.google.com/open?id=' + fileId;
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
    transformerQueue.onProgressNotify(({ total, completed }) => {
      if (this.progressNotifyCallback) {
        this.progressNotifyCallback({ total, completed });
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

  async loadNavigationHierarchy(): Promise<NavigationHierarchy> {
    const googleFiles: GoogleFile[] = await this.filesService.readJson('.folder-files.json') || [];

    const navigationFile = googleFiles.find(googleFile => googleFile.name === '.navigation' || googleFile.name === 'navigation');
    if (navigationFile) {
      const processor = new OdtProcessor(this.filesService, navigationFile.id);
      await processor.load();
      const content = processor.getContentXml();
      const parser = new UnMarshaller(LIBREOFFICE_CLASSES, 'DocumentContent');
      const navDoc: DocumentContent = parser.unmarshal(content);

      if (navDoc) {
        return await generateNavigationHierarchy(navDoc, this.logger);
      }
    }

    return {};
  }

  setTransformSubDir(transform_subdir: string) {
    this.transformSubDir = (transform_subdir || '').replaceAll('/', '').trim();
  }

  onProgressNotify(callback: ({total, completed}: { total?: number; completed?: number }) => void) {
    this.progressNotifyCallback = callback;
  }
}
