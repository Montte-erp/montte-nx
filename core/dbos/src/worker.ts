import { DBOS, WorkflowQueue } from "@dbos-inc/dbos-sdk";
import { env } from "@core/environment/worker";
import type { DbosQueueOptions } from "./client";

export type DbosWorkerQueue = {
   name: string;
   options?: DbosQueueOptions;
};

export type DbosWorkerQueueInput = DbosWorkerQueue | WorkflowQueue;

const launchState: {
   promise?: Promise<void>;
} = {};

export function createDbosQueue(queue: DbosWorkerQueueInput): WorkflowQueue {
   if (queue instanceof WorkflowQueue) return queue;
   if (!queue.options) return new WorkflowQueue(queue.name);
   return new WorkflowQueue(queue.name, queue.options);
}

export async function launchDbosWorker(queues: DbosWorkerQueueInput[]) {
   if (DBOS.isInitialized()) return;

   if (!launchState.promise) {
      launchState.promise = launchDbosRuntime(queues);
   }

   await launchState.promise;
}

export async function shutdownDbosWorker() {
   await DBOS.shutdown();
}

async function launchDbosRuntime(queues: DbosWorkerQueueInput[]) {
   const listenQueues = queues.map((queue) => createDbosQueue(queue));

   DBOS.setConfig({
      name: "montte-worker",
      systemDatabaseUrl: env.DATABASE_URL,
      logLevel: env.LOG_LEVEL ?? "info",
      runAdminServer: false,
      listenQueues,
   });

   await DBOS.launch();
}
