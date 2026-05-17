import { DBOS, WorkflowQueue } from "@dbos-inc/dbos-sdk";
import type { DbosQueueOptions } from "@core/dbos/client";
import { env } from "@core/environment/worker";
import {
   configurePostHogOtlpHeaders,
   getPostHogOtlpLogsEndpoint,
} from "@core/logging";

export type DbosWorkerQueue = {
   name: string;
   options?: DbosQueueOptions;
};

export type DbosWorkerQueueInput = DbosWorkerQueue | WorkflowQueue;

const launchState: {
   promise?: Promise<void>;
} = {};

export async function launchDbosWorker(queues: DbosWorkerQueueInput[]) {
   if (DBOS.isInitialized()) return;

   if (!launchState.promise) {
      launchState.promise = launchDbosRuntime(queues).catch((error) => {
         launchState.promise = undefined;
         throw error;
      });
   }

   await launchState.promise;
}

export async function shutdownDbosWorker() {
   await DBOS.shutdown();
   launchState.promise = undefined;
}

async function launchDbosRuntime(queues: DbosWorkerQueueInput[]) {
   const listenQueues = queues.map((queue) => queue.name);

   configurePostHogOtlpHeaders(env.POSTHOG_KEY);

   DBOS.setConfig({
      name: "montte-worker",
      systemDatabaseUrl: env.DATABASE_URL,
      enableOTLP: true,
      logLevel: env.LOG_LEVEL ?? "info",
      addContextMetadata: true,
      otlpLogsEndpoints: [getPostHogOtlpLogsEndpoint(env.POSTHOG_HOST)],
      runAdminServer: false,
      listenQueues,
   });

   await DBOS.launch();

   for (const queue of queues) {
      if (queue instanceof WorkflowQueue) {
         await DBOS.registerQueue(queue.name, {
            concurrency: queue.concurrency,
            minPollingIntervalMs: queue.minPollingIntervalMs,
            partitionQueue: queue.partitionQueue,
            priorityEnabled: queue.priorityEnabled,
            rateLimit: queue.rateLimit,
            workerConcurrency: queue.workerConcurrency,
            onConflict: "always_update",
         });
         continue;
      }

      await DBOS.registerQueue(queue.name, {
         ...queue.options,
         onConflict: queue.options?.onConflict ?? "always_update",
      });
   }
}
