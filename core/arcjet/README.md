# @core/arcjet

Rate limiting, bot detection, and request protection via Arcjet SDK.

## Exports

| Export      | Purpose                                                    |
| ----------- | ---------------------------------------------------------- |
| `./protect` | `protectWithRateLimit()` and bot detection decision helpers |
| `./client`  | Arcjet client configuration (internal)                     |

## Usage

```typescript
import { protectWithRateLimit } from "@core/arcjet/protect";

await protectWithRateLimit(request, {
  max: 100,
  interval: "1m",
  characteristics: ["ip.src"],
});
```

## How It Works

Wraps the Arcjet SDK to provide sliding-window rate limiting with configurable intervals (seconds, minutes, hours, days) and characteristic-based rules (IP address, URI path). Includes bot detection helpers that evaluate Arcjet decision results.
