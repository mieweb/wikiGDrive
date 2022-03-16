import winston from 'winston';
import {Container, ContainerConfig, ContainerConfigArr, ContainerEngine} from '../../ContainerEngine';
import {FileContentService} from '../../utils/FileContentService';
import {appendConflict, DirectoryScanner, stripConflict} from './DirectoryScanner';
import {GoogleFilesScanner} from './GoogleFilesScanner';
import {convertToRelativeMarkDownPath} from '../../LinkTranslator';
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

function processLog(realFileNameToGenerated: { [realFileName: string]: LocalFile }, destinationFiles: { [realFileName: string]: LocalFile }, localLog: LocalLog, prefix: string) {
  for (const realFileName in realFileNameToGenerated) {
    const fileToGenerate = realFileNameToGenerated[realFileName];
    const destinationEntry = Object.entries(destinationFiles).find(item => item[1].id === fileToGenerate.id);
    if (destinationEntry) {
      if (destinationEntry[0] !== realFileName) {
        localLog.append({
          filePath: prefix + realFileName,
          id: fileToGenerate.id,
          type: fileToGenerate.type,
          event: 'renamed',
        });
      }
    } else {
      if (fileToGenerate.id !== 'TO_FILL') {
        localLog.append({
          filePath: prefix + realFileName,
          id: fileToGenerate.id,
          type: fileToGenerate.type,
          event: 'created',
        });
      }
    }
  }

  for (const realFileName in destinationFiles) {
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

export class TransformContainer extends Container {
  private logger: winston.Logger;
  private generatedFileService: FileContentService;
  private hierarchy: NavigationHierarchy = {};
  private localLog: LocalLog;
  private localLinks: LocalLinks;

  constructor(public readonly params: ContainerConfig, public readonly paramsArr: ContainerConfigArr = {}) {
    super(params, paramsArr);
  }

  async mount2(fileService: FileContentService, destFileService: FileContentService): Promise<void> {
    this.filesService = fileService;
    this.generatedFileService = destFileService;
  }

  async init(engine: ContainerEngine): Promise<void> {
    await super.init(engine);
    this.logger = engine.logger.child({filename: __filename});
  }

  async syncDir(googleFolder: FileContentService, destinationDirectory: FileContentService) {
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

    processLog(realFileNameToGenerated, destinationFiles, this.localLog, destinationDirectory.getVirtualPath());

    for (const realFileName in destinationFiles) {
      if (realFileName.startsWith('.')) {
        continue;
      }

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

    const transformerQueue = new QueueTransformer(this.logger);

    for (const realFileName in realFileNameToGenerated) {
      const localFile: LocalFile = realFileNameToGenerated[realFileName];

      if (localFile.type === 'directory') {
        await destinationDirectory.mkdir(realFileName);
        const googleFolderFile = googleFolderFiles.find(f => f.id === localFile.id);
        if (googleFolderFile) {
          const googleSubFolder = await googleFolder.getSubFileService(googleFolderFile.id);
          await this.syncDir(googleSubFolder, await destinationDirectory.getSubFileService(realFileName));
        }
        continue;
      }

      const googleFile = googleFolderFiles.find(f => f.id === localFile.id);
      const task = new TaskLocalFileTransform(
        this.logger,
        realFileName,
        googleFolder,
        googleFile,
        destinationDirectory,
        localFile,
        this.hierarchy,
        this.localLinks
      );
      transformerQueue.addTask(task);
    }

    await transformerQueue.finished();

    const dirNames = destinationDirectory.getVirtualPath().replace(/\/$/, '').split('/');
    const yaml = generateDirectoryYaml(stripConflict(dirNames[dirNames.length - 1]), googleFolderData, realFileNameToGenerated);
    await destinationDirectory.writeFile('.wgd-directory.yaml', yaml);
  }

  async run(rootFolderId: FileId) {
    this.localLog = new LocalLog(this.generatedFileService);
    await this.localLog.load();
    this.localLinks = new LocalLinks(this.generatedFileService);
    await this.localLinks.load();

    this.hierarchy = await this.loadNavigationHierarchy();
    await this.syncDir(this.filesService, this.generatedFileService);

    await this.createRedirs(this.generatedFileService);
    await this.writeToc();
    await this.rewriteLinks(this.generatedFileService);

    await this.localLog.save();
    await this.localLinks.save();

    const tree = await this.regenerateTree(this.generatedFileService, rootFolderId);
    await this.generatedFileService.writeJson('.tree.json', tree);
  }

  async regenerateTree(filesService: FileContentService, parentId?: string) {
    const scanner = new DirectoryScanner();
    const files = await scanner.scan(filesService);
    const retVal = [];
    for (const realFileName in files) {
      const file = files[realFileName];
      if (file.mimeType === MimeTypes.FOLDER_MIME) {
        filesService = await filesService.getSubFileService(realFileName);
        const item = {
          id: file.id,
          name: file.fileName,
          mimeType: file.mimeType,
          parentId,
          children: await this.regenerateTree(filesService, file.id)
        };
        retVal.push(item);
      } else {
        const item = {
          id: file.id,
          name: file.fileName,
          mimeType: file.mimeType,
          parentId
        };
        retVal.push(item);
      }
    }
    return retVal;
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
            return convertToRelativeMarkDownPath(lastLog.filePath, destinationDirectory.getVirtualPath() + fileName);
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

  async createRedirs(destinationDirectory: FileContentService) {
    const rows = this.localLog.getLogs();

    const markDownScanner = new DirectoryScanner();
    const transformerQueue = new QueueTransformer(this.logger);

    for (let rowNo = rows.length - 1; rowNo >= 0; rowNo--) {
      const row = rows[rowNo];
      if (row.type === 'md' && !await destinationDirectory.exists(row.filePath)) {
        const lastLog = this.localLog.findLastFile(row.id);
        if (lastLog) {
          const parts = row.filePath.split('/');
          const fileName = parts.pop();
          const dirName = parts.join('/');

          const localFileContent = await destinationDirectory.readFile(lastLog.filePath);
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
            await destinationDirectory.getSubFileService(dirName),
            redirFile,
            localFile
          );
          transformerQueue.addTask(task);
        }
      }
    }

    await transformerQueue.finished();
  }

  async writeToc() {
    const tocGenerator = new TocGenerator();
    const md = await tocGenerator.generate(this.generatedFileService);
    await this.generatedFileService.writeFile('toc.md', md);
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async destroy(): Promise<void> {
  }

  async loadNavigationHierarchy(): Promise<NavigationHierarchy> {
    const googleFiles: GoogleFile[] = await this.filesService.readJson('.folder-files.json') || [];

    const navigationFile = googleFiles.find(googleFile => googleFile.name === '.navigation');
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

}
