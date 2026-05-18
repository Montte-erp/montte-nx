import { sha256Hash } from "@core/utils/hash";

export const CLASSIFICATION_WORKFLOW_QUEUES = {
   classify: "workflow:classify",
};

export const CLASSIFICATION_WORKFLOWS = {
   classifyTransactionsBatch: "classifyTransactionsBatchWorkflowFn",
};

export type ClassifyTransactionsBatchInput = {
   organizationId: string;
   teamId: string;
   transactionIds: string[];
};

export function buildClassifyTransactionsBatchWorkflowId(
   input: ClassifyTransactionsBatchInput,
) {
   const sorted = [...input.transactionIds].sort();
   const hash = sha256Hash(sorted.join(",")).slice(0, 12);
   return `classify-batch-${input.teamId}-${hash}`;
}
