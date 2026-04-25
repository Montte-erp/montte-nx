export const CLASSIFICATION_QUEUES = {
   classify: "classify",
   deriveKeywords: "derive-keywords",
   backfillKeywords: "backfill-keywords",
} as const;

export type ClassificationQueueName =
   (typeof CLASSIFICATION_QUEUES)[keyof typeof CLASSIFICATION_QUEUES];
