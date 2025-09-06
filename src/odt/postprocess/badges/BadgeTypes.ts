export interface Badge {
  type: string;
  label: string;
  url?: string;
  status?: 'success' | 'warning' | 'error' | 'info';
  icon?: string;
  value?: string;
}

export interface BadgeContext {
  localFile: {
    id: string;
    title: string;
    modifiedTime: Date;
    version: string;
    lastAuthor: string;
    mimeType: string;
    fileName: string;
  };
  config: {
    baseUrl?: string;
    wikiUrl?: string;
    tocUrl?: string;
  };
  links?: string[];
  duplicates?: string[];
}

export interface BadgeGenerator {
  getType(): string;
  shouldGenerate(context: BadgeContext): boolean;
  generate(context: BadgeContext): Badge | null;
}

export type BadgeStyle = 'inline' | 'compact' | 'full';

export interface BadgeRenderer {
  render(badge: Badge, style?: BadgeStyle): string;
}