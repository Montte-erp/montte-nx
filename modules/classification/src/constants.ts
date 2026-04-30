export const CLASSIFICATION_QUEUES = {
   classify: "classify",
   deriveKeywords: "derive-keywords",
   backfillKeywords: "backfill-keywords",
} as const;

export type ClassificationQueueName =
   (typeof CLASSIFICATION_QUEUES)[keyof typeof CLASSIFICATION_QUEUES];

export const CLASSIFICATION_PROMPTS = {
   classifyTransaction: "montte-classify-transaction",
   deriveKeywords: "montte-derive-keywords",
} as const;

export type ClassificationPromptKey = keyof typeof CLASSIFICATION_PROMPTS;
