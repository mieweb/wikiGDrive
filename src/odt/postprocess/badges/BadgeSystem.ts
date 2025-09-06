import { Badge, BadgeContext, BadgeGenerator, BadgeRenderer } from './BadgeTypes.ts';
import { MarkdownBadgeRenderer } from './MarkdownBadgeRenderer.ts';
import { LastProcessedBadgeGenerator } from './LastProcessedBadgeGenerator.ts';
import { PreviewLinkBadgeGenerator } from './PreviewLinkBadgeGenerator.ts';
import { TocBadgeGenerator, DuplicateAlertBadgeGenerator } from './TocAndDuplicateBadgeGenerators.ts';

export class BadgeSystem {
  private generators: BadgeGenerator[] = [];
  private renderer: BadgeRenderer;

  constructor(renderer?: BadgeRenderer) {
    this.renderer = renderer || new MarkdownBadgeRenderer();
    
    // Register default badge generators
    this.registerGenerator(new LastProcessedBadgeGenerator());
    this.registerGenerator(new PreviewLinkBadgeGenerator());
    this.registerGenerator(new TocBadgeGenerator());
    this.registerGenerator(new DuplicateAlertBadgeGenerator());
  }

  registerGenerator(generator: BadgeGenerator): void {
    this.generators.push(generator);
  }

  generateBadges(context: BadgeContext): Badge[] {
    const badges: Badge[] = [];
    
    for (const generator of this.generators) {
      if (generator.shouldGenerate(context)) {
        const badge = generator.generate(context);
        if (badge) {
          badges.push(badge);
        }
      }
    }
    
    return badges;
  }

  renderBadges(badges: Badge[]): string {
    if (badges.length === 0) {
      return '';
    }

    // Render badges as a single line with spaces between them
    const renderedBadges = badges.map(badge => this.renderer.render(badge)).join(' ');
    
    // Wrap in a div for easy identification and styling
    return `<div class="wikigdrive-badges" style="margin: 10px 0; line-height: 1.4;">${renderedBadges}</div>`;
  }

  generateAndRenderBadges(context: BadgeContext): string {
    const badges = this.generateBadges(context);
    return this.renderBadges(badges);
  }

  // Extract existing badges from content to avoid duplication
  extractExistingBadges(content: string): { content: string; badgeHtml: string | null } {
    const badgeRegex = /<div class="wikigdrive-badges"[^>]*>.*?<\/div>/s;
    const match = content.match(badgeRegex);
    
    if (match) {
      return {
        content: content.replace(badgeRegex, '').trim(),
        badgeHtml: match[0]
      };
    }
    
    return {
      content,
      badgeHtml: null
    };
  }

  // Update or insert badges in content
  updateBadgesInContent(content: string, context: BadgeContext): string {
    const { content: cleanContent } = this.extractExistingBadges(content);
    const newBadgeHtml = this.generateAndRenderBadges(context);
    
    if (!newBadgeHtml) {
      return cleanContent;
    }

    // Insert badges at the beginning of the content after any frontmatter
    const frontmatterEndMatch = cleanContent.match(/^---[\s\S]*?---\n/);
    if (frontmatterEndMatch) {
      const frontmatter = frontmatterEndMatch[0];
      const bodyContent = cleanContent.slice(frontmatter.length);
      return frontmatter + newBadgeHtml + '\n\n' + bodyContent;
    } else {
      return newBadgeHtml + '\n\n' + cleanContent;
    }
  }
}