import { Badge, BadgeContext, BadgeGenerator } from './BadgeTypes.ts';

export class PreviewLinkBadgeGenerator implements BadgeGenerator {
  getType(): string {
    return 'preview-link';
  }

  shouldGenerate(context: BadgeContext): boolean {
    return !!(context.config.wikiUrl || context.config.baseUrl) && !!context.localFile.fileName;
  }

  generate(context: BadgeContext): Badge | null {
    const baseUrl = context.config.wikiUrl || context.config.baseUrl;
    if (!baseUrl || !context.localFile.fileName) {
      return null;
    }

    // Convert filename to wiki path
    let wikiPath = context.localFile.fileName;
    if (wikiPath.endsWith('.md')) {
      wikiPath = wikiPath.slice(0, -3);
    }
    
    // Ensure it starts with /
    if (!wikiPath.startsWith('/')) {
      wikiPath = '/' + wikiPath;
    }

    const url = baseUrl.replace(/\/$/, '') + wikiPath;

    return {
      type: this.getType(),
      label: 'Preview',
      url,
      status: 'info',
      icon: '👁️'
    };
  }
}