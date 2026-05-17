import type { Queue, WorkOptions } from "pg-boss";
import { Result } from "better-result";
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

export const defaultPgBossWorkOptions = {
   localConcurrency: 2,
   pollingIntervalSeconds: 1,
} satisfies WorkOptions;

export async function startPgBossWorker(options: StartPgBossWorkerOptions) {
   const boss = await startPgBossClient({
      connectionString: options.connectionString,
      applicationName: "montte-worker-pg-boss",
   });

   const setup = await Result.tryPromise({
      try: async () => {
         for (const queue of options.queues) {
            const { name, ...queueOptions } = queue;
            await boss.createQueue(name, queueOptions);
         }
         await options.register(boss);
      },
      catch: (cause) => cause,
   });
   if (Result.isError(setup)) {
      await boss.stop({ graceful: true, timeout: 30_000 });
      throw setup.error;
   }

   return {
      boss,
      stop: () => boss.stop({ graceful: true, timeout: 30_000 }),
   };
}
