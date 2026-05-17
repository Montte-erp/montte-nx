import { log } from "@core/logging";
import { Redis } from "ioredis";

export function createRedis(url: string): Redis {
   const redis = new Redis(`${url}?family=6`, {
      maxRetriesPerRequest: null,
   });

   redis.on("error", (err) => {
      log.error({ module: "redis", message: "Connection error", err });
   });

   redis.on("connect", () => {
      log.info("redis", "Connected successfully");
   });

   return redis;
}

export type { Redis };
