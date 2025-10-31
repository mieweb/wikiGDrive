import winston from 'winston';
import {QueueTask} from './QueueTask.ts';
import {GoogleDriveService} from '../../google/GoogleDriveService.ts';
import {FileContentService} from '../../utils/FileContentService.ts';
import {BufferWritable} from '../../utils/BufferWritable.ts';
import {GoogleFile} from '../../model/GoogleFile.ts';
import {HasAccessToken} from '../../google/AuthClient.ts';
import {DocsBadgeInserter, DocumentMetadata} from '../../google/DocsBadgeInserter.ts';
import {UserConfig} from './UserConfigService.ts';
import {QuotaLimiter} from '../../google/QuotaLimiter.ts';

export class TaskFetchDocument extends QueueTask {
  constructor(protected logger: winston.Logger,
              private googleDriveService: GoogleDriveService,
              private auth: HasAccessToken,
              private fileService: FileContentService,
              private file: GoogleFile,
              private forceDownload: boolean,
              private userConfig?: UserConfig,
              private quotaLimiter?: QuotaLimiter) {
    super(logger);
  }

  async run(): Promise<QueueTask[]> {
    const odtPath = this.file.id + '.odt';

    if (await this.fileService.exists(odtPath) && !this.forceDownload) {
      return [];
    }

    // Insert badges into Google Doc if enabled and configured
    await this.insertBadgesIfEnabled();

    const destOdt = new BufferWritable();

    await this.googleDriveService.exportDocument(
      this.auth,
      { ...this.file, mimeType: 'application/vnd.oasis.opendocument.text' },
      destOdt);

    await this.fileService.writeBuffer(odtPath, destOdt.getBuffer());

    return [];
  }

  /**
   * Inserts badges into the Google Document if badge system is enabled
   */
  private async insertBadgesIfEnabled(): Promise<void> {
    // Skip if badge configuration is not available or not enabled
    if (!this.userConfig?.badge_config?.enabled || !this.quotaLimiter) {
      return;
    }

    try {
      const badgeInserter = new DocsBadgeInserter(this.logger, this.quotaLimiter);
      
      const documentMetadata: DocumentMetadata = {
        id: this.file.id,
        name: this.file.name,
        modifiedTime: this.file.modifiedTime,
        lastAuthor: this.file.lastAuthor,
        version: this.file.version
      };

      // TODO: In a full implementation, gather additional data like:
      // - isDuplicate by checking for other files with same name
      // - tocUrl by looking up the document in collections
      // - previewUrl by constructing the wiki URL
      const additionalData = {
        isDuplicate: false, // Placeholder
        duplicateCount: 0,
        tocUrl: this.userConfig.badge_config.toc_url,
        previewUrl: undefined
      };

      await badgeInserter.insertBadges(
        this.auth,
        documentMetadata,
        {
          enabled: this.userConfig.badge_config.enabled,
          base_url: this.userConfig.badge_config.base_url,
          wiki_url: this.userConfig.badge_config.wiki_url,
          toc_url: this.userConfig.badge_config.toc_url
        },
        additionalData
      );

      this.logger.info(`Successfully processed badges for document: ${this.file.name}`);
    } catch (error) {
      this.logger.error(`Failed to insert badges for document ${this.file.name}:`, error);
      // Don't fail the entire document fetch if badge insertion fails
    }
  }
}
