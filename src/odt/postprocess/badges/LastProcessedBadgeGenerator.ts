import { Badge, BadgeContext, BadgeGenerator } from './BadgeTypes.ts';

export class LastProcessedBadgeGenerator implements BadgeGenerator {
  getType(): string {
    return 'last-processed';
  }

  shouldGenerate(context: BadgeContext): boolean {
    return !!context.localFile.modifiedTime;
  }

  generate(context: BadgeContext): Badge | null {
    if (!context.localFile.modifiedTime) {
      return null;
    }

    const now = new Date();
    const modified = new Date(context.localFile.modifiedTime);
    const diffMs = now.getTime() - modified.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    let value: string;
    let status: 'success' | 'warning' | 'error' | 'info' = 'success';
    
    if (diffDays === 0) {
      if (diffHours === 0) {
        value = 'Just processed';
      } else {
        value = `${diffHours}h ago`;
      }
    } else if (diffDays < 7) {
      value = `${diffDays}d ago`;
      status = diffDays > 3 ? 'warning' : 'success';
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      value = `${weeks}w ago`;
      status = 'warning';
    } else {
      const months = Math.floor(diffDays / 30);
      value = `${months}mo ago`;
      status = 'error';
    }

    return {
      type: this.getType(),
      label: 'Last processed',
      value,
      status,
      icon: status === 'success' ? '✅' : status === 'warning' ? '⚠️' : '❌'
    };
  }
}