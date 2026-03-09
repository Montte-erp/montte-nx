import { getLogger } from "@core/logging/root";
import { Redis } from "ioredis";

const logger = getLogger().child({ module: "redis" });
let redisConnection: Redis | null = null;

export function createRedisConnection(url: string): Redis {
   if (redisConnection) {
      return redisConnection;
   }

   redisConnection = new Redis(`${url}?family=6`, {
      maxRetriesPerRequest: null,
   });

   redisConnection.on("error", (err) => {
      logger.error({ err }, "Connection error");
   });

   redisConnection.on("connect", () => {
      logger.info("Connected successfully");
   });

   return redisConnection;
}

export async function closeRedisConnection(): Promise<void> {
   if (redisConnection) {
      await redisConnection.quit();
      redisConnection = null;
      logger.info("Connection closed");
   }
}

export function getRedisConnection(): Redis | null {
   return redisConnection;
}

export type { Redis };
