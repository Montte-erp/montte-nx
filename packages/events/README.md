# @packages/events

Event catalog, emission, credit tracking, webhook delivery, and analytics integration.

## Exports

| Export                      | Purpose                             |
| --------------------------- | ----------------------------------- |
| `./catalog`                 | Event definitions and metadata      |
| `./emit`                    | `emitEvent()`, webhook queue init   |
| `./credits`                 | Credit budgeting and enforcement    |
| `./utils`                   | Event pricing and utility functions |
| `./refresh-views`           | Materialized view refresh logic     |
| `./reconcile`               | Usage reconciliation                |
| `./finance`                 | Finance domain events               |
| `./ai`                      | AI domain events                    |
| `./contact`                 | Contact domain events               |
| `./inventory`               | Inventory domain events             |
| `./service`                 | Service domain events               |
| `./webhook`                 | Webhook domain events               |
| `./dashboard`               | Dashboard domain events             |
| `./insight`                 | Insight domain events               |
| `./nfe`                     | NFe domain events                   |
| `./document`                | Document domain events              |
| `./queues/webhook-delivery` | BullMQ webhook delivery queue       |

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
