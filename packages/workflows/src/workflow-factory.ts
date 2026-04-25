import { createEnqueuer, createQueue } from "@core/dbos/factory";

export { createEnqueuer, createQueue };

export const QUEUES = {
   categorize: "categorize",
   suggestTag: "suggest-tag",
   deriveKeywords: "derive-keywords",
   deriveTagKeywords: "derive-tag-keywords",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export function createAllQueues(options: { workerConcurrency: number }) {
   return Object.values(QUEUES).map((name) => createQueue(name, options));
}
