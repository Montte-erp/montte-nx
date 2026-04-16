# @packages/notifications

Job notification types, schemas, and publisher for DBOS durable workflows.

## Exports

| Export         | Purpose                                        |
| -------------- | ---------------------------------------------- |
| `./schema`     | Zod schemas for notification payloads          |
| `./types`      | TypeScript types for notification events        |
| `./publisher`  | oRPC experimental publisher for SSE delivery   |

## Usage

```typescript
import { jobNotificationSchema } from "@packages/notifications/schema";
import type { NotificationType } from "@packages/notifications/types";
import { createJobPublisher } from "@packages/notifications/publisher";
```

## How It Works

Defines the shared contract between DBOS workflow steps (which produce notifications) and the SSE subscription endpoint (which delivers them to clients via oRPC's experimental publisher).
