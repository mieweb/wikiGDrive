# Google Docs Badge System

This system inserts badges directly into Google Documents, allowing editors to see and reposition wikiGDrive indicators while working in Google Docs. Badges are automatically filtered out during markdown conversion to keep the final output clean.

## How It Works

1. **Badge Insertion**: When wikiGDrive processes a Google Document, it uses the Google Docs API to insert badges directly into the document content.

2. **User Repositioning**: Authors can cut and paste the badge section to any location within their Google Document without breaking functionality.

3. **Badge Updates**: On subsequent processing, the system finds existing badges and updates them in place, preserving their position.

4. **Markdown Filtering**: During ODT to markdown conversion, badge markers are automatically removed to ensure badges don't appear in the final wiki output.

## Badge Types

- **Last Processed Badge**: Shows timestamp with color-coded freshness
  - ✅ Green for recent (< 24 hours)
  - ⚠️ Orange for stale (1-7 days)
  - ❌ Red for very old (> 1 week)

- **Preview Link Badge**: Direct link to rendered wiki page (👁️ icon)

- **Table of Contents Badge**: Links to collection/TOC entry (📋 icon)

- **Duplicate Alert Badge**: Warning when document duplicates are detected (⚠️ orange)

## Configuration

Enable badges in your `.wgdrive-config.yaml`:

```yaml
badge_config:
  enabled: true
  base_url: "https://wiki.example.com"
  wiki_url: "https://wiki.example.com"
  toc_url: "https://wiki.example.com/toc"
```

## Badge Format

Badges appear as a text block in the Google Document:

```
📍 WikiGDrive Badges: ✅ 2h ago 👁️ Preview 📋 Table of Contents 📍 End Badges
```

The markers (`📍 WikiGDrive Badges:` and `📍 End Badges`) help the system identify and update existing badges without creating duplicates.

## Technical Implementation

- **GoogleDocsService**: Handles Google Docs API interactions for content insertion and updates
- **DocsBadgeInserter**: Generates badge content and coordinates insertion
- **Integration Point**: Badge insertion happens in `TaskFetchDocument` before the document is downloaded as ODT

## User Workflow

1. Author works in Google Docs as normal
2. wikiGDrive processes the document and inserts/updates badges
3. Author can cut/paste the badge block to reposition it within Google Docs
4. Future processing updates badges in their repositioned location
5. Document is converted to markdown with badges filtered out (badges remain only in Google Docs)

This approach ensures badges are visible and manageable within the Google Docs editing environment while keeping the final markdown output clean and focused on content.