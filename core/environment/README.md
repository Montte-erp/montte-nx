# @core/environment

Centralized, Zod-validated environment variable configuration for all runtime contexts.

## Exports

| Export      | Context                                                           |
| ----------- | ----------------------------------------------------------------- |
| `./web`     | Server-side env vars (DATABASE_URL, auth secrets, API keys, etc.) |
| `./helpers` | Environment utility functions                                     |

## Usage

```typescript
import { env } from "@core/environment/web";

env.DATABASE_URL;
env.BETTER_AUTH_SECRET;
env.POSTHOG_KEY;
```

## How It Works

Uses `@t3-oss/env-core` with Zod schemas to validate all environment variables at startup. If any required variable is missing or invalid, the process fails fast with a descriptive error.

Variables are grouped by concern: database, auth, payments (Stripe), analytics (PostHog), email (Resend), storage (MinIO), AI services (OpenRouter, Tavily, Exa, Firecrawl), security (Arcjet), and general config.

Public env vars use `createServerFn` + loader data — never `VITE_*` / `import.meta.env`.
