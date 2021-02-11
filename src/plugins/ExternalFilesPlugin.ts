'use strict';

import {BasePlugin} from './BasePlugin';
import {HttpClient} from '../utils/HttpClient';
import {ExternalFiles} from '../storage/ExternalFiles';
import {FilesStructure} from '../storage/FilesStructure';
import {FileService} from '../utils/FileService';

import * as path from 'path';
import * as async from 'async';
import {DriveConfig} from "./ConfigDirPlugin";

async function convertImageLink(document, url) {
  if (document.inlineObjects[url]) {
    const inlineObject = document.inlineObjects[url];

    const embeddedObject = inlineObject.inlineObjectProperties.embeddedObject;
    if (embeddedObject.imageProperties) {
      if (embeddedObject.imageProperties.sourceUri || embeddedObject.imageProperties.contentUri) {
        url = embeddedObject.imageProperties.sourceUri || embeddedObject.imageProperties.contentUri;
      } else {
        url = '';
      }
    }
  }

  if (!url) {
    return '';
  }

  return url;
}

async function processRecursive(json, func) {
  if (Array.isArray(json)) {
    for (const item of json) {
      await processRecursive(item, func);
    }
  } else
  if (typeof json === 'object') {
    for (let k in json) {
      await processRecursive(json[k], func);
    }
    await func(json);
  }
}

export class ExternalFilesPlugin extends BasePlugin {
  private externalFiles: ExternalFiles;
  private filesStructure: FilesStructure;
  private config_dir: string;
  private dest: string;

  constructor(eventBus) {
    super(eventBus);

    eventBus.on('main:init', async (params) => {
      this.config_dir = params.config_dir;
    });
    eventBus.on('drive_config:loaded', async (drive_config: DriveConfig) => {
      this.dest = drive_config.dest;
      await this.init();
    });
    eventBus.on('files_structure:initialized', async ({ filesStructure }) => {
      this.filesStructure = filesStructure;
    });
    eventBus.on('download:clean', async () => {
      await this.process();
      this.eventBus.emit('external:done');
    });
    eventBus.on('external:process', async () => {
      await this.process();
      this.eventBus.emit('external:done');
    });
  }

  private async init() {
    this.externalFiles = new ExternalFiles(this.config_dir, new HttpClient(), this.dest);
    await this.externalFiles.init();
    await this.externalFiles.cleanup();
    this.eventBus.emit('external_files:initialized', { externalFiles: this.externalFiles });
  }

  async process() {
    const files = this.filesStructure.findFiles(item => !item.dirty && FilesStructure.DOCUMENT_MIME === item.mimeType);

    for (const file of files) {
      const links = await this.extractExternalFiles(file);
      for (const url of links) {
        await this.externalFiles.addLink(url, { url, md5Checksum: null });
      }
    }

    await this.download();
  }

  async extractExternalFiles(file) {
    const links = {};
    const fileService = new FileService();

    try {
      const filePath = path.join(this.config_dir, 'files', file.id + '.gdoc');

      const content = await fileService.readFile(filePath);
      const document = JSON.parse(content);

      await processRecursive(document.body.content, async (json) => {
        if (json.inlineObjectElement) {
          const url = json.inlineObjectElement.inlineObjectId;
          links[await convertImageLink(document, url)] = true;
        }
      });
    } catch (ignore) { /* eslint-disable-line no-empty */
    }

    return Object.keys(links);
  }

  async download() {
    const linksToDownload = await this.externalFiles.findLinks(link => !link.md5Checksum);

    if (linksToDownload.length > 0) {
      console.log('Downloading external files (' + linksToDownload.length + ')');
    } else {
      return;
    }

    const concurrency = 4;

    const q = async.queue(async (task, callback) => {
      switch (task.type) {
        case 'download':
          await this.downloadFile(task.url);
          break;
        default:
          console.error('Unknown task type: ' + task.type)
      }
      callback();
    }, concurrency);

    q.error(function(err, task) {
      task.retry = (task.retry || 0) + 1;
      if (task.retry < 5) {
        q.push(task);
      }
    });

    for (const link of linksToDownload) {
      q.push({ type: 'download', url: link.url });
    }

    await q.drain();
    console.log('Downloading external files finished');
  }

  async downloadFile(url) {
    const tempPath = await this.externalFiles.downloadTemp(url, path.join(this.dest, 'external_files'));
    const fileService = new FileService();
    const md5Checksum = await fileService.md5File(tempPath);

    if (md5Checksum) {
      const localPath = path.join('external_files', md5Checksum + '.png');
      await fileService.move(tempPath, path.join(this.dest, localPath));

      await this.externalFiles.putFile({
        localPath: localPath,
        md5Checksum: md5Checksum
      });

      await this.externalFiles.addLink(url, { url, md5Checksum });
    }

    // md5
  }

  async flushData() {
    return await this.externalFiles.flushData();
  }

}
