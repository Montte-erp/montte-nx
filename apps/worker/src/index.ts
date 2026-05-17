import { DBOS } from "@dbos-inc/dbos-sdk";
import { env } from "@core/environment/worker";
import { initLogger, getLogger } from "@core/logging/root";
import { initOtel, shutdownOtel } from "@core/logging/otel";
import { createDb } from "@core/database/client";
import { createRedis } from "@core/redis/connection";
import { createPostHog, createPromptsClient } from "@core/posthog/server";
import { setupAgentsWorkflows } from "@modules/agents/workflows/setup";
import { setupClassificationWorkflows } from "@modules/classification/workflows/setup";

initOtel({
   serviceName: "montte-worker",
   posthogKey: env.POSTHOG_KEY,
   posthogHost: env.POSTHOG_HOST,
});

initLogger({
   name: "montte-worker",
   level: env.LOG_LEVEL,
   posthog: {
      apiKey: env.POSTHOG_KEY,
      host: env.POSTHOG_HOST,
   },
});

const logger = getLogger();
const db = createDb({ databaseUrl: env.DATABASE_URL });
const redis = createRedis(env.REDIS_URL);
const posthog = createPostHog(env.POSTHOG_KEY, env.POSTHOG_HOST);
const promptsClient = createPromptsClient({
   personalApiKey: env.POSTHOG_PERSONAL_API_KEY,
   projectApiKey: env.POSTHOG_KEY,
   host: env.POSTHOG_HOST,
});

logger.info("Starting worker");

await setupClassificationWorkflows({
   redis,
   posthog,
   prompts: promptsClient,
   workerConcurrency: 10,
});
await setupAgentsWorkflows({
   redis,
   posthog,
   prompts: promptsClient,
   workerConcurrency: 10,
});

DBOS.setConfig({
   name: "montte-worker",
   systemDatabaseUrl: env.DATABASE_URL,
   logLevel: env.LOG_LEVEL ?? "info",
   runAdminServer: false,
});

DBOS.launch()
   .then(() => {
      logger.info("DBOS runtime started");
   })
   .catch((err: unknown) => {
      logger.error({ err }, "DBOS launch failed");
   });

async function gracefulShutdown(signal: string) {
   logger.info(`${signal} received — shutting down`);
   await DBOS.shutdown();
   await posthog.shutdown();
   redis.disconnect();
   await shutdownOtel();
   logger.info("Shutdown complete");
   process.exit(0);
}

process.on("SIGTERM", () => void gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => void gracefulShutdown("SIGINT"));

void db;
