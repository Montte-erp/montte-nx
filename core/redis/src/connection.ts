import { getLogger } from "@core/logging";
import { Redis } from "ioredis";

export function createRedis(url: string): Redis {
   const logger = getLogger().child({ module: "redis" });

   const redis = new Redis(`${url}?family=6`, {
      maxRetriesPerRequest: null,
   });

   redis.on("error", (err) => {
      logger.error({ err }, "Connection error");
   });

   redis.on("connect", () => {
      logger.info("Connected successfully");
   });

   return redis;
}

export type { Redis };
