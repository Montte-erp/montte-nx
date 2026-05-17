import type { Queue, WorkOptions } from "pg-boss";
import { Result, TaggedError, type Result as ResultType } from "better-result";
import type { PgBossClient } from "@core/pg-boss/client";
import { startPgBossClient } from "@core/pg-boss/client";

export type PgBossQueueDefinition = Omit<Queue, "name"> & {
   name: string;
};

export type StartPgBossWorkerOptions = {
   connectionString: string;
   queues: PgBossQueueDefinition[];
   register: (boss: PgBossClient) => Promise<void>;
};

export class PgBossWorkerError extends TaggedError("PgBossWorkerError")<{
   operation: "setup_worker";
   message: string;
   queueNames: string[];
   cause?: unknown;
}>() {}

export const defaultPgBossWorkOptions = {
   localConcurrency: 2,
   batchSize: 1,
   pollingIntervalSeconds: 1,
   heartbeatRefreshSeconds: 15,
   priority: true,
   orderByCreatedOn: true,
} satisfies WorkOptions;

export type PgBossWorkerRuntime = {
   boss: PgBossClient;
   stop: () => Promise<void>;
};

export async function startPgBossWorker(
   options: StartPgBossWorkerOptions,
): Promise<ResultType<PgBossWorkerRuntime, PgBossWorkerError>> {
   const started = await Result.tryPromise({
      try: () =>
         startPgBossClient({
            connectionString: options.connectionString,
            applicationName: "montte-worker-pg-boss",
         }),
      catch: (cause) =>
         new PgBossWorkerError({
            operation: "setup_worker",
            message: "Não foi possível iniciar o pg-boss.",
            queueNames: options.queues.map((queue) => queue.name),
            cause,
         }),
   });
   if (Result.isError(started)) return Result.err(started.error);

   const boss = started.value;
   const setup = await Result.tryPromise({
      try: async () => {
         for (const queue of options.queues) {
            const { name, partition, policy, ...queueOptions } = queue;
            await boss.createQueue(name, {
               ...queueOptions,
               partition,
               policy,
            });
            await boss.updateQueue(name, queueOptions);
         }
         await options.register(boss);
         return {
            boss,
            stop: () => boss.stop({ graceful: true, timeout: 30_000 }),
         };
      },
      catch: (cause) =>
         new PgBossWorkerError({
            operation: "setup_worker",
            message: "Não foi possível preparar as filas do pg-boss.",
            queueNames: options.queues.map((queue) => queue.name),
            cause,
         }),
   });
   if (Result.isError(setup)) {
      await Result.tryPromise({
         try: () => boss.stop({ graceful: true, timeout: 30_000 }),
         catch: (cause) =>
            new PgBossWorkerError({
               operation: "setup_worker",
               message:
                  "Não foi possível parar o pg-boss após falha de preparação.",
               queueNames: options.queues.map((queue) => queue.name),
               cause,
            }),
      });
      return Result.err(setup.error);
   }
   return Result.ok(setup.value);
}
