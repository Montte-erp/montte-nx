# @core/logging

Pino-based structured logging with OpenTelemetry integration.

## Exports

| Export          | Purpose                                      |
| --------------- | -------------------------------------------- |
| `.`             | Logger factory and child logger creation     |
| `./server`      | Server-side logger initialization            |
| `./worker`      | Worker-side logger initialization            |
| `./root`        | Root logger singleton                        |
| `./types`       | Logger type definitions                      |
| `./otel`        | OpenTelemetry transport configuration        |
| `./health`      | Health check endpoint utilities              |
| `./orpc-plugin` | oRPC middleware for request/response logging |
| `./errors`      | Error handling and formatting utilities      |

## Usage

```typescript
import { createSafeLogger } from "@core/logging";
import type { Logger } from "@core/logging/types";

const logger = createSafeLogger("my-module");
logger.info("something happened");
logger.error({ err }, "something failed");
```

## Behavior

- **Development:** Pretty-printed, colorized output for readability
- **Production:** JSON-structured logs for machine consumption
- **OpenTelemetry:** Optional log export to observability backends
- **Safe fallback:** If logger initialization fails, a no-op safe logger is used instead of crashing
