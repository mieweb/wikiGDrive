import {Logger} from 'winston';
import {HasAccessToken} from './AuthClient.ts';
import {GoogleDocsService, DocsBadgeContent, DocsBadgeSection} from './GoogleDocsService.ts';
import {FileId} from '../model/model.ts';
import {QuotaLimiter} from './QuotaLimiter.ts';

export interface BadgeConfig {
  enabled: boolean;
  base_url?: string;
  wiki_url?: string;
  toc_url?: string;
}

export interface DocumentMetadata {
  id: FileId;
  name: string;
  modifiedTime?: string;
  lastAuthor?: string;
  version?: string;
  // Add other metadata as needed
}

/**
 * Service for inserting wikiGDrive badges into Google Documents
 */
export class DocsBadgeInserter {
  private googleDocsService: GoogleDocsService;

  constructor(
    private logger: Logger,
    quotaLimiter: QuotaLimiter
  ) {
    this.googleDocsService = new GoogleDocsService(logger, quotaLimiter);
  }

  /**
   * Inserts or updates badges in a Google Document based on metadata
   */
  async insertBadges(
    auth: HasAccessToken,
    documentMetadata: DocumentMetadata,
    config: BadgeConfig,
    additionalData?: {
      isDuplicate?: boolean;
      duplicateCount?: number;
      tocUrl?: string;
      previewUrl?: string;
    }
  ): Promise<void> {
    if (!config.enabled) {
      this.logger.debug(`Badge insertion disabled for document ${documentMetadata.id}`);
      return;
    }

    try {
      const badges = this.generateBadges(documentMetadata, config, additionalData);
      const badgeSection: DocsBadgeSection = { badges };

      await this.googleDocsService.insertOrUpdateBadges(
        auth,
        documentMetadata.id,
        badgeSection
      );

      this.logger.info(`Successfully inserted badges into document ${documentMetadata.id} (${documentMetadata.name})`);
    } catch (error) {
      this.logger.error(`Failed to insert badges into document ${documentMetadata.id}:`, error);
      // Don't throw - badge insertion failure shouldn't stop document processing
    }
  }

  /**
   * Generates badges based on document metadata and configuration
   */
  private generateBadges(
    metadata: DocumentMetadata,
    config: BadgeConfig,
    additionalData?: {
      isDuplicate?: boolean;
      duplicateCount?: number;
      tocUrl?: string;
      previewUrl?: string;
    }
  ): DocsBadgeContent[] {
    const badges: DocsBadgeContent[] = [];

    // Last processed badge
    const lastProcessedBadge = this.createLastProcessedBadge(metadata.modifiedTime);
    if (lastProcessedBadge) {
      badges.push(lastProcessedBadge);
    }

    // Preview link badge
    if (config.wiki_url || config.base_url) {
      const previewBadge = this.createPreviewBadge(
        metadata,
        additionalData?.previewUrl || config.wiki_url || config.base_url
      );
      if (previewBadge) {
        badges.push(previewBadge);
      }
    }

    // Table of contents badge
    if (config.toc_url || additionalData?.tocUrl) {
      const tocBadge = this.createTocBadge(
        additionalData?.tocUrl || config.toc_url
      );
      if (tocBadge) {
        badges.push(tocBadge);
      }
    }

    // Duplicate alert badge
    if (additionalData?.isDuplicate) {
      const duplicateBadge = this.createDuplicateBadge(additionalData.duplicateCount || 1);
      if (duplicateBadge) {
        badges.push(duplicateBadge);
      }
    }

    return badges;
  }

  /**
   * Creates a last processed badge with color-coded freshness
   */
  private createLastProcessedBadge(modifiedTime?: string): DocsBadgeContent | null {
    if (!modifiedTime) {
      return {
        text: '❓ Unknown processing time'
      };
    }

    const now = new Date();
    const modified = new Date(modifiedTime);
    const ageInHours = (now.getTime() - modified.getTime()) / (1000 * 60 * 60);

    let emoji: string;
    let status: string;

    if (ageInHours < 24) {
      emoji = '✅';
      status = this.formatTimeAgo(ageInHours);
    } else if (ageInHours < 168) { // 1 week
      emoji = '⚠️';
      status = `${Math.floor(ageInHours / 24)}d ago`;
    } else {
      emoji = '❌';
      status = `${Math.floor(ageInHours / 168)}w ago`;
    }

    return {
      text: `${emoji} ${status}`
    };
  }

  /**
   * Creates a preview link badge
   */
  private createPreviewBadge(
    metadata: DocumentMetadata,
    baseUrl: string
  ): DocsBadgeContent | null {
    // Create a simple preview badge
    // In a full implementation, this would construct the proper wiki URL
    return {
      text: '👁️ Preview',
      link: `${baseUrl}/${this.sanitizeForUrl(metadata.name)}`
    };
  }

  /**
   * Creates a table of contents badge
   */
  private createTocBadge(tocUrl: string): DocsBadgeContent | null {
    return {
      text: '📋 Table of Contents',
      link: tocUrl
    };
  }

  /**
   * Creates a duplicate alert badge
   */
  private createDuplicateBadge(duplicateCount: number): DocsBadgeContent | null {
    const countText = duplicateCount > 1 ? ` (${duplicateCount})` : '';
    return {
      text: `⚠️ Duplicate${countText}`
    };
  }

  /**
   * Formats time ago in a human-readable format
   */
  private formatTimeAgo(hours: number): string {
    if (hours < 1) {
      const minutes = Math.floor(hours * 60);
      return minutes <= 1 ? 'Just now' : `${minutes}m ago`;
    } else if (hours < 24) {
      return `${Math.floor(hours)}h ago`;
    } else {
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    }
  }

  /**
   * Sanitizes a string for use in URLs
   */
  private sanitizeForUrl(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
}