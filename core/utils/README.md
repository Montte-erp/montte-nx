# @core/utils

Small shared pure utilities for code used across packages or domain modules.

This package is intentionally subpath-only. Do not add a root barrel export.

## Exports

| Export    | Purpose                                      |
| --------- | -------------------------------------------- |
| `./dates` | Minimal shared date predicates               |
| `./hash`  | Stable hashes for workflow and job IDs       |
| `./text`  | Shared text transforms such as organization slugs |

## Rules

- Add helpers only when at least two packages or modules need the same pure behavior.
- Keep domain helpers in the owning module.
- Keep UI helpers in the app or package that renders the UI.
- Use official stack libraries directly when they already express the intent clearly.
- Do not depend on logger, db, redis, PostHog, auth, or other infrastructure packages.
- Do not add logging redaction helpers here; request and oRPC logs use evlog redaction.

## Usage

```typescript
import { isIsoDateString } from "@core/utils/dates";
import { sha256Hash } from "@core/utils/hash";
import { createSlug } from "@core/utils/text";
```
