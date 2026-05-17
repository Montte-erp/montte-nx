import { z } from "zod";
import { createDb } from "@core/database/client";
import { getLogger, initLogger } from "@core/logging/root";
import { PgBossJobError, startPgBossClient } from "./client";
import { fromDrizzleTransaction } from "./drizzle";

const envSchema = z.object({
   DATABASE_URL: z.string().min(1),
});

const env = envSchema.parse(process.env);

initLogger({ name: "pg-boss-smoke", level: "info" });
const logger = getLogger();

const suffix = process.pid.toString(36);
const completeQueue = `smoke-complete-${suffix}`;
const retryQueue = `smoke-retry-${suffix}`;
const drizzleQueue = `smoke-drizzle-${suffix}`;

function waitForSignal(label: string) {
   let done = false;
   return {
      resolve() {
         done = true;
      },
      promise: new Promise<void>((resolve, reject) => {
         const interval = setInterval(() => {
            if (!done) return;
            clearInterval(interval);
            clearTimeout(timeout);
            resolve();
         }, 50);
         const timeout = setTimeout(() => {
            clearInterval(interval);
            reject(new PgBossJobError(`${label} não concluiu a tempo.`));
         }, 10_000);
      }),
   };
}

async function waitForCompletedJob(options: {
   boss: Awaited<ReturnType<typeof startPgBossClient>>;
   queue: string;
   jobId: string;
}) {
   for (let attempt = 0; attempt < 40; attempt += 1) {
      const jobs = await options.boss.findJobs(options.queue, {
         id: options.jobId,
      });
      const job = jobs.find((item) => item.id === options.jobId);
      if (job?.state === "completed") return;
      await Bun.sleep(250);
   }
   throw new PgBossJobError(`Job ${options.jobId} não ficou completed.`);
}

const boss = await startPgBossClient({
   connectionString: env.DATABASE_URL,
   applicationName: "montte-pg-boss-smoke",
});
const db = createDb({ databaseUrl: env.DATABASE_URL, max: 2 });

await boss.createQueue(completeQueue, {
   retryLimit: 1,
   retryDelay: 1,
   deleteAfterSeconds: 60,
});
await boss.createQueue(retryQueue, {
   retryLimit: 1,
   retryDelay: 1,
   deleteAfterSeconds: 60,
});
await boss.createQueue(drizzleQueue, {
   retryLimit: 1,
   retryDelay: 1,
   deleteAfterSeconds: 60,
});

const completeSignal = waitForSignal("job completo");
await boss.work<{ value: string }>(completeQueue, async (jobs) => {
   for (const job of jobs) {
      if (job.data.value !== "ok") {
         throw new PgBossJobError("Payload inesperado no smoke completo.");
      }
      completeSignal.resolve();
   }
});
const completeJobId = await boss.send(completeQueue, { value: "ok" });
if (!completeJobId) throw new PgBossJobError("Smoke não criou job completo.");
await completeSignal.promise;
await waitForCompletedJob({ boss, queue: completeQueue, jobId: completeJobId });

let retryAttempts = 0;
const retrySignal = waitForSignal("retry");
await boss.work<{ value: string }>(retryQueue, async (jobs) => {
   for (const job of jobs) {
      retryAttempts += 1;
      if (retryAttempts === 1) {
         throw new PgBossJobError("Falha intencional para validar retry.");
      }
      if (job.data.value !== "retry") {
         throw new PgBossJobError("Payload inesperado no smoke retry.");
      }
      retrySignal.resolve();
   }
});
const retryJobId = await boss.send(retryQueue, { value: "retry" });
if (!retryJobId) throw new PgBossJobError("Smoke não criou job de retry.");
await retrySignal.promise;
if (retryAttempts < 2) {
   throw new PgBossJobError("Retry não executou a segunda tentativa.");
}
await waitForCompletedJob({ boss, queue: retryQueue, jobId: retryJobId });

const drizzleSignal = waitForSignal("Drizzle transaction");
await boss.work<{ value: string }>(drizzleQueue, async (jobs) => {
   for (const job of jobs) {
      if (job.data.value !== "drizzle") {
         throw new PgBossJobError("Payload inesperado no smoke Drizzle.");
      }
      drizzleSignal.resolve();
   }
});
const drizzleJobId = await db.transaction((tx) =>
   boss.send(
      drizzleQueue,
      { value: "drizzle" },
      { db: fromDrizzleTransaction(tx) },
   ),
);
if (!drizzleJobId) {
   throw new PgBossJobError("Smoke não criou job dentro da transação Drizzle.");
}
await drizzleSignal.promise;
await waitForCompletedJob({ boss, queue: drizzleQueue, jobId: drizzleJobId });

await boss.stop({ graceful: true, timeout: 5_000 });
logger.info(
   {
      completeJobId,
      retryJobId,
      drizzleJobId,
      retryAttempts,
   },
   "pg-boss smoke passed",
);
