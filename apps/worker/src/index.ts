import { env } from "@core/environment/web";
import {
   startHealthHeartbeat,
   stopHealthHeartbeat,
} from "@core/logging/health";
import { initOtel, shutdownOtel } from "@core/logging/otel";
import { initLogger } from "@core/logging/root";
import { shutdownPosthog } from "@core/posthog/server";
import { createQueueConnection } from "@packages/events/queues/connection";
import { db, posthog, redis } from "./singletons";
import { startScheduler } from "./scheduler";
import { startWebhookDeliveryWorker } from "./workers/webhook-delivery";

const logger = initLogger({ name: "montte-worker", level: "info" });

initOtel({
   serviceName: "montte-worker",
   posthogKey: env.POSTHOG_KEY,
   posthogHost: env.POSTHOG_HOST,
});
startHealthHeartbeat({ serviceName: "montte-worker", posthog });

async function main(): Promise<void> {
   logger.info("Starting Montte Worker...");

   const queueConnection = createQueueConnection(env.REDIS_URL);

   const webhookWorker = startWebhookDeliveryWorker(queueConnection);

   const scheduledTasks = startScheduler(db);

   logger.info("All systems running");

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
