# @core/redis

Redis connection singleton for caching, sessions, and real-time operations.

## Exports

| Export | Purpose |
|--------|---------|
| `./connection` | Redis client factory and singleton instance |

## Usage

```typescript
import { getRedisConnection } from "@core/redis/connection";

const redis = getRedisConnection();
await redis.set("key", "value");
await redis.get("key");
```

## Details

Built on `ioredis` with IPv6 support (`family=6`). Provides a single shared connection with error handling and logging integration. Used by authentication (session caching), credit tracking, and BullMQ job queues.
