import { BadgeSystem } from '../../src/odt/postprocess/badges/BadgeSystem.ts';
import { BadgeContext } from '../../src/odt/postprocess/badges/BadgeTypes.ts';

// Simple test function since we can't import asserts easily
function assertEquals(actual: any, expected: any, message?: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message || 'Assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertStringContains(actual: string, expected: string, message?: string) {
  if (!actual.includes(expected)) {
    throw new Error(`${message || 'Assertion failed'}: expected "${actual}" to contain "${expected}"`);
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

// Test data
const testContext: BadgeContext = {
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
    baseUrl: 'https://wiki.example.com',
    wikiUrl: 'https://wiki.example.com',
    tocUrl: 'https://wiki.example.com/toc'
  },
  links: ['https://example.com/link1'],
  duplicates: []
};

const testContextWithDuplicates: BadgeContext = {
  ...testContext,
  duplicates: ['duplicate1.md', 'duplicate2.md']
};

// Run tests
runTest('BadgeSystem generates badges', () => {
  const badgeSystem = new BadgeSystem();
  const badges = badgeSystem.generateBadges(testContext);
  
  // Should generate at least last-processed, preview-link, and toc-link badges
  assertEquals(badges.length >= 3, true, 'Should generate at least 3 badges');
  
  const badgeTypes = badges.map(b => b.type);
  assertEquals(badgeTypes.includes('last-processed'), true, 'Should include last-processed badge');
  assertEquals(badgeTypes.includes('preview-link'), true, 'Should include preview-link badge');
  assertEquals(badgeTypes.includes('toc-link'), true, 'Should include toc-link badge');
});

runTest('BadgeSystem generates duplicate alert when duplicates exist', () => {
  const badgeSystem = new BadgeSystem();
  const badges = badgeSystem.generateBadges(testContextWithDuplicates);
  
  const duplicateBadge = badges.find(b => b.type === 'duplicate-alert');
  assertEquals(!!duplicateBadge, true, 'Should include duplicate-alert badge when duplicates exist');
  assertEquals(duplicateBadge?.value, '2 duplicates', 'Should show correct duplicate count');
});

runTest('BadgeSystem renders badges as HTML', () => {
  const badgeSystem = new BadgeSystem();
  const badges = badgeSystem.generateBadges(testContext);
  const html = badgeSystem.renderBadges(badges);
  
  assertStringContains(html, '<div class="wikigdrive-badges"', 'Should wrap badges in div');
  assertStringContains(html, '<span style="background-color:', 'Should contain styled spans');
  assertStringContains(html, 'href="https://wiki.example.com/test-document"', 'Should contain preview link');
});

runTest('BadgeSystem updates content without duplication', () => {
  const badgeSystem = new BadgeSystem();
  const content = `---
title: Test
---

# Test Document

This is the content.`;

  const updatedContent = badgeSystem.updateBadgesInContent(content, testContext);
  
  assertStringContains(updatedContent, '<div class="wikigdrive-badges"', 'Should add badges to content');
  assertStringContains(updatedContent, '# Test Document', 'Should preserve original content');
  
  // Update again to ensure no duplication
  const updatedAgain = badgeSystem.updateBadgesInContent(updatedContent, testContext);
  const badgeMatches = (updatedAgain.match(/<div class="wikigdrive-badges"/g) || []).length;
  assertEquals(badgeMatches, 1, 'Should not duplicate badges on second update');
});

runTest('BadgeSystem handles content without frontmatter', () => {
  const badgeSystem = new BadgeSystem();
  const content = `# Test Document

This is the content.`;

  const updatedContent = badgeSystem.updateBadgesInContent(content, testContext);
  
  assertStringContains(updatedContent, '<div class="wikigdrive-badges"', 'Should add badges to content');
  assertStringContains(updatedContent, '# Test Document', 'Should preserve original content');
});

console.log('Badge system tests completed!');