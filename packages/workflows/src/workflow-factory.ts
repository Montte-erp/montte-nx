import type { DBOSClient } from "@dbos-inc/dbos-sdk";
import { WorkflowQueue } from "@dbos-inc/dbos-sdk";

export const QUEUES = {
   categorize: "categorize",
   suggestTag: "suggest-tag",
   deriveKeywords: "derive-keywords",
   deriveTagKeywords: "derive-tag-keywords",
   usageIngestion: "usage-ingestion",
   benefitLifecycle: "benefit-lifecycle",
   periodEndInvoice: "period-end-invoice",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export function createAllQueues(options: { workerConcurrency: number }) {
   return Object.values(QUEUES).map((name) => createQueue(name, options));
}

export function createQueue(
   name: string,
   options: { workerConcurrency: number },
) {
   return new WorkflowQueue(`workflow:${name}`, options);
}

export function createEnqueuer<T>(
   workflowName: string,
   name: string,
   getWorkflowId?: (input: T) => string,
) {
   const queueName = `workflow:${name}`;
   return (client: DBOSClient, input: T) =>
      client.enqueue(
         {
            workflowName,
            queueName,
            ...(getWorkflowId && { workflowID: getWorkflowId(input) }),
         },
         input,
      );
}
