import { Badge, BadgeRenderer, BadgeStyle } from './BadgeTypes.ts';

export class MarkdownBadgeRenderer implements BadgeRenderer {
  render(badge: Badge, style: BadgeStyle = 'inline'): string {
    const statusColors = {
      success: '#4CAF50',
      warning: '#FF9800', 
      error: '#F44336',
      info: '#2196F3'
    };

    const bgColor = badge.status ? statusColors[badge.status] : '#666';
    const icon = badge.icon || '';
    const text = badge.value || badge.label;
    
    // Create a shield-like badge using HTML with inline styles
    // This format is portable and will render in most markdown viewers
    const badgeContent = icon ? `${icon} ${text}` : text;
    
    if (badge.url) {
      return `<a href="${badge.url}" style="text-decoration: none;"><span style="background-color: ${bgColor}; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; white-space: nowrap; display: inline-block;">${badgeContent}</span></a>`;
    } else {
      return `<span style="background-color: ${bgColor}; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; white-space: nowrap; display: inline-block;">${badgeContent}</span>`;
    }
  }
}