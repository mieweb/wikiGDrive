#!/usr/bin/env -S deno run --allow-all

import { BadgeSystem } from '../src/odt/postprocess/badges/BadgeSystem.ts';
import { BadgeContext } from '../src/odt/postprocess/badges/BadgeTypes.ts';

console.log('🎯 WikiGDrive Badge System Demo\n');

// Example document context
const exampleContext: BadgeContext = {
  localFile: {
    id: '1a2b3c4d5e6f7g8h9i0j',
    title: 'Getting Started Guide',
    modifiedTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    version: '42',
    lastAuthor: 'jane.doe@example.com',
    mimeType: 'application/vnd.google-apps.document',
    fileName: 'getting-started.md'
  },
  config: {
    baseUrl: 'https://docs.example.com',
    wikiUrl: 'https://wiki.example.com',
    tocUrl: 'https://wiki.example.com/table-of-contents'
  },
  links: [
    'https://example.com/api-reference',
    'https://example.com/tutorials'
  ],
  duplicates: ['guides/getting-started-copy.md'] // Example duplicate
};

const badgeSystem = new BadgeSystem();

console.log('📋 Generated Badges:');
const badges = badgeSystem.generateBadges(exampleContext);
badges.forEach((badge, index) => {
  console.log(`${index + 1}. ${badge.type}: ${badge.label}${badge.value ? ` - ${badge.value}` : ''}${badge.url ? ` (${badge.url})` : ''}`);
});

console.log('\n🎨 Rendered Badge HTML:');
const badgeHtml = badgeSystem.renderBadges(badges);
console.log(badgeHtml);

console.log('\n📄 Example Document with Badges:');
const sampleDocument = `---
title: "Getting Started Guide"
id: "1a2b3c4d5e6f7g8h9i0j"
date: 2025-01-15T08:30:00Z
version: 42
lastAuthor: "jane.doe@example.com"
mimeType: "application/vnd.google-apps.document"
links:
  - "https://example.com/api-reference"
  - "https://example.com/tutorials"
source: "https://drive.google.com/open?id=1a2b3c4d5e6f7g8h9i0j"
---

# Getting Started Guide

Welcome to our platform! This guide will help you get up and running quickly.

## Prerequisites

Before you begin, make sure you have:
- A valid account
- Basic understanding of markdown
- Access to the documentation

## Quick Start

1. Clone the repository
2. Install dependencies
3. Run the development server

That's it! You're ready to go.`;

const documentWithBadges = badgeSystem.updateBadgesInContent(sampleDocument, exampleContext);
console.log(documentWithBadges);

console.log('\n✨ Badge System Features:');
console.log('• ✅ Extensible architecture - add new badge types easily');
console.log('• 🎯 Deterministic updates - badges are replaced, not duplicated');
console.log('• 🎨 GitHub shield-like styling with status colors');
console.log('• 📱 Responsive HTML badges that work in any markdown viewer');
console.log('• ⚙️ Configurable URLs and enabled badge types');
console.log('• 🔗 Smart URL handling for preview and navigation links');
console.log('• ⏰ Time-aware freshness indicators');
console.log('• 🔍 Duplicate detection and alerting');

console.log('\n🚀 Badge system is ready for integration!');