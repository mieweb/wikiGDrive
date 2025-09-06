import { BadgeSystem } from '../../src/odt/postprocess/badges/BadgeSystem.ts';
import { BadgeContext } from '../../src/odt/postprocess/badges/BadgeTypes.ts';

// Simple test function
function assertStringContains(actual: string, expected: string, message?: string) {
  if (!actual.includes(expected)) {
    throw new Error(`${message || 'Assertion failed'}: expected "${actual}" to contain "${expected}"`);
  }
}

function assertStringNotContains(actual: string, notExpected: string, message?: string) {
  if (actual.includes(notExpected)) {
    throw new Error(`${message || 'Assertion failed'}: expected "${actual}" to NOT contain "${notExpected}"`);
  }
}

function runTest(name: string, testFn: () => void) {
  try {
    testFn();
    console.log(`✅ ${name} - PASSED`);
  } catch (error) {
    console.error(`❌ ${name} - FAILED: ${error.message}`);
  }
}

// Test with minimal context (no URLs configured)
const minimalContext: BadgeContext = {
  localFile: {
    id: 'test-doc-id',
    title: 'Test Document',
    modifiedTime: new Date('2025-01-01T10:00:00Z'),
    version: '1',
    lastAuthor: 'test@example.com',
    mimeType: 'application/vnd.google-apps.document',
    fileName: 'test-document.md'
  },
  config: {
    // No URLs configured
  },
  links: [],
  duplicates: []
};

// Test with only baseUrl
const partialContext: BadgeContext = {
  ...minimalContext,
  config: {
    baseUrl: 'https://wiki.example.com'
  }
};

runTest('Badge system gracefully handles missing configuration', () => {
  const badgeSystem = new BadgeSystem();
  const badges = badgeSystem.generateBadges(minimalContext);
  
  // Should still generate last-processed badge (doesn't need URLs)
  const lastProcessedBadge = badges.find(b => b.type === 'last-processed');
  if (!lastProcessedBadge) {
    throw new Error('Should generate last-processed badge even without URLs');
  }
  
  // Should not generate preview or toc badges without URLs
  const previewBadge = badges.find(b => b.type === 'preview-link');
  const tocBadge = badges.find(b => b.type === 'toc-link');
  
  if (previewBadge) {
    throw new Error('Should not generate preview badge without baseUrl/wikiUrl');
  }
  
  if (tocBadge) {
    throw new Error('Should not generate toc badge without baseUrl/tocUrl');
  }
});

runTest('Badge system works with partial configuration', () => {
  const badgeSystem = new BadgeSystem();
  const badges = badgeSystem.generateBadges(partialContext);
  
  // Should generate last-processed, preview, and toc badges
  const badgeTypes = badges.map(b => b.type);
  
  if (!badgeTypes.includes('last-processed')) {
    throw new Error('Should include last-processed badge');
  }
  if (!badgeTypes.includes('preview-link')) {
    throw new Error('Should include preview-link badge with baseUrl');
  }
  if (!badgeTypes.includes('toc-link')) {
    throw new Error('Should include toc-link badge with baseUrl');
  }
});

runTest('Badge system handles content with existing badges correctly', () => {
  const badgeSystem = new BadgeSystem();
  
  const contentWithExistingBadges = `---
title: Test
---

<div class="wikigdrive-badges" style="margin: 10px 0; line-height: 1.4;"><span style="background-color: #4CAF50; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; white-space: nowrap; display: inline-block;">✅ Just processed</span></div>

# Test Document

This is the content.`;

  const { content: cleanContent, badgeHtml } = badgeSystem.extractExistingBadges(contentWithExistingBadges);
  
  assertStringNotContains(cleanContent, 'wikigdrive-badges', 'Should remove existing badges from content');
  assertStringContains(cleanContent, '# Test Document', 'Should preserve other content');
  
  if (!badgeHtml) {
    throw new Error('Should extract existing badge HTML');
  }
  assertStringContains(badgeHtml, 'wikigdrive-badges', 'Should extract badge HTML');
});

runTest('Badge system preserves frontmatter structure', () => {
  const badgeSystem = new BadgeSystem();
  
  const contentWithComplexFrontmatter = `---
title: "Test Document"
author: "Test Author"
date: 2025-01-01
tags:
  - test
  - example
categories: ["docs", "tests"]
---

# Main Content

Some content here.`;

  const updatedContent = badgeSystem.updateBadgesInContent(contentWithComplexFrontmatter, partialContext);
  
  // Check that frontmatter is preserved
  assertStringContains(updatedContent, 'title: "Test Document"', 'Should preserve title');
  assertStringContains(updatedContent, 'tags:', 'Should preserve tags');
  assertStringContains(updatedContent, 'categories: ["docs", "tests"]', 'Should preserve categories');
  
  // Check that badges are inserted after frontmatter
  const frontmatterEndIndex = updatedContent.indexOf('---\n', 4); // Find second ---
  const badgeIndex = updatedContent.indexOf('<div class="wikigdrive-badges"');
  
  if (frontmatterEndIndex === -1) {
    throw new Error('Should preserve frontmatter delimiter');
  }
  if (badgeIndex === -1) {
    throw new Error('Should add badges');
  }
  if (badgeIndex <= frontmatterEndIndex) {
    throw new Error('Should place badges after frontmatter');
  }
});

console.log('Integration tests completed!');