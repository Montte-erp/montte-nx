import { DBOS } from "@dbos-inc/dbos-sdk";
import { Result, TaggedError } from "better-result";
import { env } from "@core/environment/worker";
import { initLogger, log } from "@core/logging";
import { initOtel, shutdownOtel } from "@core/logging";
import { createDb } from "@core/database/client";
import { createRedis } from "@core/redis/connection";
import { createPostHog, createPromptsClient } from "@core/posthog/server";
import { setupAgentsWorkflows } from "@modules/agents/workflows/setup";
import { setupClassificationWorkflows } from "@modules/classification/workflows/setup";

class WorkerInitError extends TaggedError("WorkerInitError")<{
   message: string;
   cause: unknown;
}>() {}

async function initWorker() {
   initOtel({
      serviceName: "montte-worker",
      posthogKey: env.POSTHOG_KEY,
      posthogHost: env.POSTHOG_HOST,
   });

   initLogger({
      name: "montte-worker",
      level: env.LOG_LEVEL,
      posthogKey: env.POSTHOG_KEY,
      posthogHost: env.POSTHOG_HOST,
   });

   return Result.tryPromise({
      try: async () => {
         const db = createDb({ databaseUrl: env.DATABASE_URL });
         const redis = createRedis(env.REDIS_URL);
         const posthog = createPostHog(env.POSTHOG_KEY, env.POSTHOG_HOST);
         const promptsClient = createPromptsClient({
            personalApiKey: env.POSTHOG_PERSONAL_API_KEY,
            projectApiKey: env.POSTHOG_KEY,
            host: env.POSTHOG_HOST,
         });

         log.info("worker", "Starting worker");

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
            logLevel: env.LOG_LEVEL,
            runAdminServer: false,
         });

         await DBOS.launch();
         log.info("worker", "DBOS runtime started");

         return { db, redis, posthog };
      },
      catch: (cause) =>
         new WorkerInitError({
            message: "Falha ao iniciar worker.",
            cause,
         }),
   });
}

const worker = await initWorker();
if (worker.isErr()) {
   log.error({
      module: "worker",
      message: worker.error.message,
      err: worker.error.cause,
   });
   process.exit(1);
}

async function gracefulShutdown(signal: string) {
   log.info("worker", `${signal} received — shutting down`);
   await DBOS.shutdown();
   await worker.value.posthog.shutdown();
   worker.value.redis.disconnect();
   await shutdownOtel();
   log.info("worker", "Shutdown complete");
   process.exit(0);
}

process.on("SIGTERM", () => void gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => void gracefulShutdown("SIGINT"));

void worker.value.db;
