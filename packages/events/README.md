# @packages/events

Event catalog, emission, credit tracking, webhook delivery, and analytics integration.

## Exports

| Export                    | Purpose                                                     |
| ------------------------- | ----------------------------------------------------------- |
| `./catalog`               | Event definitions and metadata                              |
| `./emit`                  | `emitEvent()`, `emitEventBatch()`, webhook queue init       |
| `./credits`               | Credit budgeting and enforcement                            |
| `./utils`                 | Event pricing and utility functions                         |
| `./finance`, `./ai`, etc. | Domain-specific event categories                            |
| `./queues/*`              | BullMQ queue abstractions (webhook delivery, budget alerts) |

## Usage

```typescript
import { emitEvent } from "@packages/events/emit";

await emitEvent({
   event: "transaction.created",
   organizationId,
   teamId,
   properties: { amount, currency },
});
```

## How It Works

`emitEvent()` is non-throwing (inner try-catch) and handles billable event tracking via Stripe meter events, PostHog capture, and webhook delivery queuing. `enforceCreditBudget()` checks per-organization usage against plan limits and throws on budget exceeded (wrap as `ORPCError("FORBIDDEN")` in routers). Free-tier enforcement is built in.
