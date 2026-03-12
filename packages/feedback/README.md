# @packages/feedback

Multi-adapter feedback collection via PostHog, Discord, and GitHub.

## Exports

| Export       | Purpose                                        |
| ------------ | ---------------------------------------------- |
| `./sender`   | `feedbackSender` singleton with `send(message)` |
| `./schemas`  | Zod-validated feedback message schema          |

## Usage

```typescript
import { feedbackSender } from "@packages/feedback/sender";

await feedbackSender.send({
  type: "bug",
  message: "Button not working",
  userId: "user-id",
});
```

## How It Works

Uses an adapter pattern with pluggable backends (PostHog survey, Discord webhook, GitHub issue). Adapters are lazily initialized based on available environment variables. All adapters run in parallel via `Promise.allSettled()` for graceful error handling.
