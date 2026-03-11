import { createDb } from "@core/database/client";
import { env } from "@core/environment/worker";
import {
   startHealthHeartbeat,
   stopHealthHeartbeat,
} from "@core/logging/health";
import { initOtel, shutdownOtel } from "@core/logging/otel";
import { initLogger } from "@core/logging/root";
import { getElysiaPosthogConfig, shutdownPosthog } from "@core/posthog/server";
import { createQueueConnection } from "@packages/queue/connection";
import { createRedisConnection } from "@core/redis/connection";
import { startScheduler } from "./scheduler";
import { startWebhookDeliveryWorker } from "./workers/webhook-delivery";

const logger = initLogger({ name: "montte-worker", level: "info" });

// Initialize OTel SDK for PostHog logs
initOtel({
   serviceName: "montte-worker",
   posthogKey: env.POSTHOG_KEY,
   posthogHost: env.POSTHOG_HOST,
});
const posthog = getElysiaPosthogConfig(env);
startHealthHeartbeat({ serviceName: "montte-worker", posthog });

async function main(): Promise<void> {
   logger.info("Starting Montte Worker...");

   // 1. Initialize Redis
   const redis = createRedisConnection(env.REDIS_URL);

   // 2. Initialize Database
   const db = createDb({ databaseUrl: env.DATABASE_URL });

   // 3. Create BullMQ connection
   const queueConnection = createQueueConnection(env.REDIS_URL);

   // 4. Start BullMQ workers
   const webhookWorker = startWebhookDeliveryWorker(queueConnection, db);

   // 5. Start scheduled jobs
   const scheduledTasks = startScheduler(db, redis);

   logger.info("All systems running");

   // Graceful shutdown
   const shutdown = async (signal: string) => {
      logger.info({ signal }, "Received shutdown signal");

      for (const task of scheduledTasks) {
         task.stop();
      }

      await webhookWorker.close();
      await redis.quit();
      stopHealthHeartbeat();
      await shutdownPosthog(posthog);
      await shutdownOtel();

      logger.info("Shutdown complete");
      process.exit(0);
   };

   process.on("SIGTERM", () => shutdown("SIGTERM"));
   process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((error) => {
   logger.fatal({ err: error }, "Fatal error");
   process.exit(1);
});
