import {Logger} from 'winston';
import {HasAccessToken} from './AuthClient.ts';
import {FileId} from '../model/model.ts';
import {driveFetch} from './driveFetch.ts';
import {QuotaLimiter} from './QuotaLimiter.ts';

export interface DocsBadgeContent {
  text: string;
  link?: string;
}

export interface DocsBadgeSection {
  badges: DocsBadgeContent[];
}

/**
 * Service for interacting with Google Docs API to insert and update content
 */
export class GoogleDocsService {
  private static readonly BADGE_MARKER_START = '📍 WikiGDrive Badges:';
  private static readonly BADGE_MARKER_END = '📍 End Badges';

  constructor(
    private logger: Logger,
    private quotaLimiter: QuotaLimiter
  ) {}

  /**
   * Inserts or updates badges in a Google Document
   */
  async insertOrUpdateBadges(
    auth: HasAccessToken,
    documentId: FileId,
    badgeSection: DocsBadgeSection
  ): Promise<void> {
    try {
      // First, get the document content to find existing badges
      const document = await this.getDocument(auth, documentId);
      
      // Find existing badge section
      const existingBadgeRange = this.findBadgeSection(document);
      
      // Generate badge text
      const badgeText = this.generateBadgeText(badgeSection);
      
      if (existingBadgeRange) {
        // Update existing badges
        await this.updateBadgeSection(auth, documentId, existingBadgeRange, badgeText);
      } else {
        // Insert new badges at the beginning of the document
        await this.insertBadgeSection(auth, documentId, badgeText);
      }
    } catch (error) {
      this.logger.error(`Failed to insert badges into document ${documentId}:`, error);
      throw error;
    }
  }

  /**
   * Retrieves a Google Document's content
   */
  private async getDocument(auth: HasAccessToken, documentId: FileId): Promise<any> {
    const accessToken = await auth.getAccessToken();
    
    const url = `https://docs.googleapis.com/v1/documents/${documentId}`;
    
    return await this.quotaLimiter.throttle(async () => {
      const response = await driveFetch(accessToken, url, {
        method: 'GET'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get document: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    });
  }

  /**
   * Finds the existing badge section in the document
   */
  private findBadgeSection(document: any): {startIndex: number, endIndex: number} | null {
    const content = document.body?.content || [];
    
    let startIndex = -1;
    let endIndex = -1;
    
    for (const element of content) {
      if (element.paragraph?.elements) {
        for (const textElement of element.paragraph.elements) {
          const text = textElement.textRun?.content || '';
          
          if (text.includes(GoogleDocsService.BADGE_MARKER_START) && startIndex === -1) {
            startIndex = textElement.startIndex;
          }
          
          if (text.includes(GoogleDocsService.BADGE_MARKER_END) && startIndex !== -1) {
            endIndex = textElement.endIndex;
            break;
          }
        }
        
        if (endIndex !== -1) break;
      }
    }
    
    return startIndex !== -1 && endIndex !== -1 ? {startIndex, endIndex} : null;
  }

  /**
   * Generates the formatted badge text
   */
  private generateBadgeText(badgeSection: DocsBadgeSection): string {
    const badgeTexts = badgeSection.badges.map(badge => {
      if (badge.link) {
        // For now, just include the text - Google Docs API linking is complex
        // TODO: Implement proper hyperlinks using the insertText with textStyle
        return badge.text;
      }
      return badge.text;
    });
    
    const badgeContent = badgeTexts.join(' ');
    
    return `${GoogleDocsService.BADGE_MARKER_START} ${badgeContent} ${GoogleDocsService.BADGE_MARKER_END}\n\n`;
  }

  /**
   * Updates existing badge section
   */
  private async updateBadgeSection(
    auth: HasAccessToken,
    documentId: FileId,
    range: {startIndex: number, endIndex: number},
    newText: string
  ): Promise<void> {
    const accessToken = await auth.getAccessToken();
    
    const requests = [
      {
        deleteContentRange: {
          range: {
            startIndex: range.startIndex,
            endIndex: range.endIndex
          }
        }
      },
      {
        insertText: {
          location: {
            index: range.startIndex
          },
          text: newText
        }
      }
    ];
    
    await this.batchUpdate(accessToken, documentId, requests);
  }

  /**
   * Inserts new badge section at the beginning of the document
   */
  private async insertBadgeSection(
    auth: HasAccessToken,
    documentId: FileId,
    badgeText: string
  ): Promise<void> {
    const accessToken = await auth.getAccessToken();
    
    const requests = [
      {
        insertText: {
          location: {
            index: 1  // Insert at the very beginning after the document start
          },
          text: badgeText
        }
      }
    ];
    
    await this.batchUpdate(accessToken, documentId, requests);
  }

  /**
   * Executes a batch update on the document
   */
  private async batchUpdate(
    accessToken: string,
    documentId: FileId,
    requests: any[]
  ): Promise<void> {
    const url = `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`;
    
    const body = {
      requests: requests
    };
    
    await this.quotaLimiter.throttle(async () => {
      const response = await driveFetch(accessToken, url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update document: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      return await response.json();
    });
  }
}