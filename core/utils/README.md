# @core/utils

Shared utility functions used across the entire monorepo. Zero external dependencies — pure TypeScript.

## Modules

| Export | Purpose |
|--------|---------|
| `./array` | Array utilities (Fisher-Yates shuffle) |
| `./date` | Date formatting, relative time, timezone support |
| `./diff` | Diff and change detection |
| `./file` | File utilities |
| `./number` | Number formatting and manipulation |
| `./object` | Object utilities |
| `./permissions` | Permission checking |
| `./sanitization` | Data sanitization |
| `./text` | Text normalization, slugs, word count, readability scoring |

## Usage

```typescript
import { shuffleArray } from "@core/utils/array";
import { formatDate, formatRelativeTime } from "@core/utils/date";
import { normalizeText, createSlug, countWords } from "@core/utils/text";
```

## Key Functions

- **`formatDate(date, pattern, options?)`** — Format dates with pattern tokens (YYYY, MM, DD, HH, mm, ss) and locale/timezone support
- **`formatRelativeTime(date)`** — Human-readable relative time ("5 minutos atrás")
- **`createSlug(name)`** — Convert text to URL-safe slugs
- **`calculateReadabilityScore(text)`** — Flesch reading ease adapted for Portuguese
- **`getInitials(name)`** — Extract user initials from name or email
- **`createDescriptionFromText(text)`** — Auto-generate meta descriptions (160 chars)
