# @core/environment

Centralized, Zod-validated environment variable configuration for all runtime contexts.

## Exports

| Export | Context |
|--------|---------|
| `./server` | Server-side env vars (DATABASE_URL, auth secrets, API keys, etc.) |
| `./client` | Client-side env vars (VITE_POSTHOG_HOST, VITE_POSTHOG_KEY) |
| `./worker` | Worker-specific env vars (concurrency, queue config) |
| `./helpers` | Environment utility functions |

## Usage

```typescript
import { env } from "@core/environment/server";

env.DATABASE_URL;
env.BETTER_AUTH_SECRET;
env.POSTHOG_KEY;
```

## How It Works

Uses `@t3-oss/env-core` with Zod schemas to validate all environment variables at startup. If any required variable is missing or invalid, the process fails fast with a descriptive error.

Variables are grouped by concern: database, auth, payments (Stripe), analytics (PostHog), email (Resend), storage (MinIO), AI services (OpenRouter, Tavily, Exa, Firecrawl), security (Arcjet), and general config.

Client-side variables require the `VITE_` prefix and are safe to expose in the browser bundle.
