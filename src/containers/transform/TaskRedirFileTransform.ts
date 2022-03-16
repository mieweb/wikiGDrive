import {QueueTask} from '../google_folder/QueueTask';
import winston from 'winston';
import {FileContentService} from '../../utils/FileContentService';
import {LocalFile, RedirFile} from '../../model/LocalFile';
import {generateRedirectMarkdown} from './frontmatters/generateRedirectMarkdown';

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
