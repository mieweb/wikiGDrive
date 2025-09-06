import { Badge, BadgeContext, BadgeGenerator } from './BadgeTypes.ts';

export class TocBadgeGenerator implements BadgeGenerator {
  getType(): string {
    return 'toc-link';
  }

  shouldGenerate(context: BadgeContext): boolean {
    return !!(context.config.tocUrl || context.config.baseUrl);
  }

  generate(context: BadgeContext): Badge | null {
    const tocUrl = context.config.tocUrl || (context.config.baseUrl ? context.config.baseUrl.replace(/\/$/, '') + '/toc' : null);
    if (!tocUrl) {
      return null;
    }

    return {
      type: this.getType(),
      label: 'Table of Contents',
      url: tocUrl,
      status: 'info',
      icon: '📋'
    };
  }
}

export class DuplicateAlertBadgeGenerator implements BadgeGenerator {
  getType(): string {
    return 'duplicate-alert';
  }

  shouldGenerate(context: BadgeContext): boolean {
    return !!(context.duplicates && context.duplicates.length > 0);
  }

  generate(context: BadgeContext): Badge | null {
    if (!context.duplicates || context.duplicates.length === 0) {
      return null;
    }

    const count = context.duplicates.length;
    const value = count === 1 ? '1 duplicate' : `${count} duplicates`;

    return {
      type: this.getType(),
      label: 'Duplicate Alert',
      value,
      status: 'warning',
      icon: '⚠️'
    };
  }
}