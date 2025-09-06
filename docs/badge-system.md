# WikiGDrive Badge System

The WikiGDrive Badge System provides unobtrusive indicators (badges) inside Google Docs processed by wikiGDrive. Badges behave like GitHub README shields: lightweight visual tokens containing links or status indicators.

## Features

- **Extensible**: Add new badge types by implementing the `BadgeGenerator` interface
- **Deterministic**: Badges are updated in place, not duplicated during reprocessing
- **Portable**: Uses inline HTML that renders in most markdown viewers
- **Configurable**: Badge URLs and behavior can be configured per installation
- **Non-intrusive**: Badges appear as compact, styled elements that don't interfere with content

## Default Badge Types

### 1. Last Processed Badge
- **Type**: `last-processed`
- **Purpose**: Shows timestamp of last wikiGDrive processing
- **Status Colors**:
  - ✅ Green: Recently processed (< 3 days)
  - ⚠️ Orange: Somewhat stale (3-7 days)
  - ❌ Red: Very stale (> 7 days)

### 2. Preview Link Badge
- **Type**: `preview-link`
- **Purpose**: Links directly to the rendered wiki page
- **Icon**: 👁️ (eye)
- **Requirements**: `baseUrl` or `wikiUrl` configuration

### 3. Table of Contents Badge
- **Type**: `toc-link`
- **Purpose**: Links to the collection/TOC entry
- **Icon**: 📋 (clipboard)
- **Requirements**: `tocUrl` or `baseUrl` configuration

### 4. Duplicate Alert Badge
- **Type**: `duplicate-alert`
- **Purpose**: Indicates if the document is duplicated elsewhere
- **Icon**: ⚠️ (warning)
- **Status**: Orange warning color
- **Condition**: Only appears when duplicates are detected

## Configuration

### User Configuration
Add badge configuration to your `.user_config.json`:

```json
{
  "badge_config": {
    "enabled": true,
    "base_url": "https://wiki.example.com",
    "wiki_url": "https://wiki.example.com",
    "toc_url": "https://wiki.example.com/table-of-contents",
    "badges": ["last-processed", "preview-link", "toc-link", "duplicate-alert"]
  }
}
```

### Environment Variables
You can also configure badge URLs using environment variables:
- `WIKIGDRIVE_BASE_URL`: Base URL for the wiki
- `WIKIGDRIVE_WIKI_URL`: Specific URL for wiki pages
- `WIKIGDRIVE_TOC_URL`: URL for table of contents

### Configuration Options
- `enabled`: Whether badges are enabled (default: true)
- `base_url`: Base URL used as fallback for other URLs
- `wiki_url`: URL for preview links (defaults to base_url)
- `toc_url`: URL for table of contents links
- `badges`: Array of enabled badge types (optional, defaults to all)

## Usage

Badges are automatically generated and inserted during document processing. They appear after the frontmatter but before the main content:

```markdown
---
title: "My Document"
id: "abc123"
---
<div class="wikigdrive-badges">
  <!-- Badges rendered here -->
</div>

# My Document

Content goes here...
```

### Manual Badge Management

Authors can cut and paste the entire badge container (`<div class="wikigdrive-badges">...</div>`) to reposition badges anywhere in the document. The system will recognize and update badges regardless of their location.

## Extending the Badge System

### Creating a New Badge Type

1. **Implement BadgeGenerator interface**:

```typescript
import { Badge, BadgeContext, BadgeGenerator } from './BadgeTypes.ts';

export class CustomBadgeGenerator implements BadgeGenerator {
  getType(): string {
    return 'custom-badge';
  }

  shouldGenerate(context: BadgeContext): boolean {
    // Return true if this badge should be generated
    return context.localFile.title.includes('Important');
  }

  generate(context: BadgeContext): Badge | null {
    if (!this.shouldGenerate(context)) {
      return null;
    }

    return {
      type: this.getType(),
      label: 'Important',
      status: 'warning',
      icon: '⭐',
      value: 'High Priority'
    };
  }
}
```

2. **Register the generator**:

```typescript
import { BadgeSystem } from './BadgeSystem.ts';
import { CustomBadgeGenerator } from './CustomBadgeGenerator.ts';

const badgeSystem = new BadgeSystem();
badgeSystem.registerGenerator(new CustomBadgeGenerator());
```

### Badge Interface

```typescript
interface Badge {
  type: string;           // Unique identifier for the badge type
  label: string;          // Display label for the badge
  url?: string;           // Optional link URL
  status?: 'success' | 'warning' | 'error' | 'info'; // Status color
  icon?: string;          // Optional emoji or text icon
  value?: string;         // Optional value to display instead of label
}
```

### Badge Context

The `BadgeContext` provides information about the document and configuration:

```typescript
interface BadgeContext {
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
  links?: string[];      // Links found in the document
  duplicates?: string[]; // Detected duplicate files
}
```

## Badge Styling

Badges use inline CSS for maximum portability:

- **Colors**: Material Design inspired status colors
- **Typography**: System font stack for cross-platform consistency
- **Size**: 11px font size for unobtrusive appearance
- **Shape**: Rounded corners (3px border-radius)
- **Spacing**: 2px vertical, 6px horizontal padding

### Status Colors
- **Success** (`#4CAF50`): Green for positive states
- **Warning** (`#FF9800`): Orange for attention needed
- **Error** (`#F44336`): Red for problems
- **Info** (`#2196F3`): Blue for informational badges

## Technical Details

### Badge Identification
Badges are wrapped in a container with the class `wikigdrive-badges`:

```html
<div class="wikigdrive-badges" style="margin: 10px 0; line-height: 1.4;">
  <!-- Individual badge spans -->
</div>
```

### Duplicate Prevention
The system extracts existing badges before generating new ones, ensuring badges are updated rather than duplicated during reprocessing.

### Integration Point
Badge processing occurs in `TaskLocalFileTransform.ts` during the final markdown generation phase, ensuring badges have access to all document metadata.

## Examples

See `examples/badge-demo.ts` for a complete working example of the badge system in action.

## Testing

Run the badge system tests:

```bash
deno run --allow-all test/badges/BadgeSystemTest.ts
deno run --allow-all test/badges/BadgeIntegrationTest.ts
```

Run the interactive demo:

```bash
deno run --allow-all examples/badge-demo.ts
```