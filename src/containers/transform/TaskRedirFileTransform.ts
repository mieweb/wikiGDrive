import winston from 'winston';

import {QueueTask} from '../google_folder/QueueTask.ts';
import {FileContentService} from '../../utils/FileContentService.ts';
import {LocalFile, RedirFile} from '../../model/LocalFile.ts';
import {generateRedirectMarkdown} from './frontmatters/generateRedirectMarkdown.ts';

export class TaskRedirFileTransform extends QueueTask {
  constructor(protected logger: winston.Logger,
              private realFileName: string,
              private destinationDirectory: FileContentService,
              private redirFile: RedirFile,
              private localFile: LocalFile
  ) {
    super(logger);

    if (!this.localFile.fileName) {
      throw new Error(`No fileName for: ${this.localFile.id}`);
    }
  }

  async run(): Promise<QueueTask[]> {
    const md = generateRedirectMarkdown(this.redirFile, this.localFile);
    await this.destinationDirectory.writeFile(this.realFileName, md);

    return [];
  }
}
