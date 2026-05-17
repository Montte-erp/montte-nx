import { DBOS } from "@dbos-inc/dbos-sdk";
import { Result, TaggedError } from "better-result";
import { env } from "@core/environment/worker";
import { flushLogger, initLogger, log } from "@core/logging";
import { initOtel, shutdownOtel } from "@core/logging";
import { createDb } from "@core/database/client";
import { startPgBossWorker } from "@core/pg-boss/worker";
import { createRedis } from "@core/redis/connection";
import { createPostHog, createPromptsClient } from "@core/posthog/server";
import {
   agentPgBossQueues,
   registerAgentPgBossJobs,
} from "@modules/agents/jobs/setup";
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

         const pgBossWorker = await startPgBossWorker({
            connectionString: env.DATABASE_URL,
            queues: agentPgBossQueues,
            register: (boss) =>
               registerAgentPgBossJobs({
                  boss,
                  db,
                  prompts: promptsClient,
                  redis,
               }),
         });
         log.info("worker", "pg-boss runtime started");

         return { db, redis, posthog, pgBossWorker };
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
   await flushLogger();
   process.exit(1);
}

const workerDeps = worker.value;

async function gracefulShutdown(signal: string) {
   log.info("worker", `${signal} received — shutting down`);
   const shutdowns: { name: string; promise: Promise<unknown> }[] = [
      { name: "pg-boss", promise: workerDeps.pgBossWorker.stop() },
      { name: "dbos", promise: DBOS.shutdown() },
      { name: "posthog", promise: workerDeps.posthog.shutdown() },
      {
         name: "redis",
         promise: Promise.resolve(workerDeps.redis.disconnect()),
      },
      { name: "otel", promise: shutdownOtel() },
   ];
   const results = await Promise.allSettled(
      shutdowns.map((shutdown) => shutdown.promise),
   );
   results.forEach((result, index) => {
      if (result.status === "rejected") {
         log.error({
            module: "worker",
            message: "shutdown step failed",
            service: shutdowns[index]?.name,
            err: result.reason,
         });
      }
   });
   log.info("worker", "Shutdown complete");
   await flushLogger();
   process.exit(0);
}

process.on("SIGTERM", () => void gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => void gracefulShutdown("SIGINT"));

void workerDeps.db;
