import type { Queue, WorkOptions } from "pg-boss";
import type { PgBossClient } from "./client";
import { startPgBossClient } from "./client";

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

   for (const queue of options.queues) {
      const { name, ...queueOptions } = queue;
      await boss.createQueue(name, queueOptions);
   }

   await options.register(boss);

   return {
      boss,
      stop: () => boss.stop({ graceful: true, timeout: 30_000 }),
   };
}
