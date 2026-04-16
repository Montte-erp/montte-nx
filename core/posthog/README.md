# @core/posthog

PostHog analytics client for server-side event tracking, feature flags, and error capture.

## Exports

| Export     | Purpose                                               |
| ---------- | ----------------------------------------------------- |
| `./server` | PostHog client initialization and analytics functions |
| `./config` | Survey IDs, feature flag keys, and shared config      |

## Usage

```typescript
import {
   captureServerEvent,
   isFeatureEnabled,
   identifyUser,
   captureError,
} from "@core/posthog/server";
```

## Functions

- **`getElysiaPosthogConfig()`** — Initialize the PostHog client
- **`identifyUser(userId, properties)`** — Set user properties
- **`setGroup(groupType, groupKey, properties)`** — Set organization/group properties
- **`captureServerEvent(distinctId, event, properties)`** — Track custom events
- **`captureError(error, context)`** — Track error events
- **`isFeatureEnabled(flag, distinctId)`** — Evaluate feature flags
- **`getFeatureFlag(flag, distinctId)`** — Get feature flag value with context
- **`getAllFeatureFlags(distinctId)`** — Get all flags for a user
- **`shutdownPosthog()`** — Graceful shutdown
