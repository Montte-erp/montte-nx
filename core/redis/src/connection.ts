import { env } from "@core/environment/server";
import { getLogger } from "@core/logging/root";
import { Redis } from "ioredis";

const logger = getLogger().child({ module: "redis" });

export const redis = new Redis(`${env.REDIS_URL}?family=6`, {
   maxRetriesPerRequest: null,
});

export function getRedisConnection(): Redis {
   return redis;
}

redis.on("error", (err) => {
   logger.error({ err }, "Connection error");
});

redis.on("connect", () => {
   logger.info("Connected successfully");
});

export type { Redis };
