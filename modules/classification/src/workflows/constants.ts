import { createHash } from "node:crypto";

export const CLASSIFICATION_WORKFLOW_QUEUES = {
   classify: "workflow:classify",
   deriveKeywords: "workflow:derive-keywords",
};

export const CLASSIFICATION_WORKFLOWS = {
   classifyTransactionsBatch: "classifyTransactionsBatchWorkflowFn",
   deriveKeywords: "deriveKeywordsWorkflowFn",
};

export type ClassifyTransactionsBatchInput = {
   organizationId: string;
   teamId: string;
   transactionIds: string[];
};

export type DeriveKeywordsWorkflowInput = {
   categoryId: string;
   teamId: string;
   organizationId: string;
   name: string;
   description?: string | null;
   userId?: string;
};

export function buildClassifyTransactionsBatchWorkflowId(
   input: ClassifyTransactionsBatchInput,
) {
   const sorted = [...input.transactionIds].sort();
   const hash = createHash("sha256")
      .update(sorted.join(","))
      .digest("hex")
      .slice(0, 12);
   return `classify-batch-${input.teamId}-${hash}`;
}

export function buildDeriveKeywordsWorkflowId(
   input: DeriveKeywordsWorkflowInput,
) {
   return `derive-category-${input.categoryId}`;
}
