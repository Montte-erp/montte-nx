import { err, ok, type Result } from "neverthrow";
import {
   enqueueDbosWorkflow,
   type DbosQueueError,
   type DbosWorkflowHandle,
   matchDbosQueueResult,
   type WorkflowClient,
} from "@core/dbos/client";
import {
   buildClassifyTransactionsBatchWorkflowId,
   buildDeriveKeywordsWorkflowId,
   CLASSIFICATION_WORKFLOW_QUEUES,
   CLASSIFICATION_WORKFLOWS,
   type ClassifyTransactionsBatchInput,
   type DeriveKeywordsWorkflowInput,
} from "@modules/classification/workflows/constants";

export class ClassificationWorkflowQueueError extends Error {
   readonly operation: "classify_transactions" | "derive_keywords";
   readonly cause: DbosQueueError;

   constructor(input: {
      operation: "classify_transactions" | "derive_keywords";
      message: string;
      cause: DbosQueueError;
   }) {
      super(input.message);
      this.name = "ClassificationWorkflowQueueError";
      this.operation = input.operation;
      this.cause = input.cause;
   }
}

export function isClassificationWorkflowQueueFailure<T>(
   result: Result<T, ClassificationWorkflowQueueError>,
) {
   return result.isErr();
}

export async function enqueueClassifyTransactionsBatchWorkflow(
   client: WorkflowClient,
   input: ClassifyTransactionsBatchInput,
): Promise<Result<DbosWorkflowHandle, ClassificationWorkflowQueueError>> {
   const queued = await enqueueDbosWorkflow({
      client,
      queueName: CLASSIFICATION_WORKFLOW_QUEUES.classify,
      workflow: {
         queueName: CLASSIFICATION_WORKFLOW_QUEUES.classify,
         workflowName: CLASSIFICATION_WORKFLOWS.classifyTransactionsBatch,
         workflowID: buildClassifyTransactionsBatchWorkflowId(input),
      },
      payload: input,
   });
   return matchDbosQueueResult(queued, {
      err: (
         cause,
      ): Result<DbosWorkflowHandle, ClassificationWorkflowQueueError> =>
         err(
            new ClassificationWorkflowQueueError({
               operation: "classify_transactions",
               message:
                  "Não foi possível enfileirar a classificação de lançamentos.",
               cause,
            }),
         ),
      ok: (
         value,
      ): Result<DbosWorkflowHandle, ClassificationWorkflowQueueError> =>
         ok(value),
   });
}

export async function enqueueDeriveKeywordsWorkflow(
   client: WorkflowClient,
   input: DeriveKeywordsWorkflowInput,
): Promise<Result<DbosWorkflowHandle, ClassificationWorkflowQueueError>> {
   const queued = await enqueueDbosWorkflow({
      client,
      queueName: CLASSIFICATION_WORKFLOW_QUEUES.deriveKeywords,
      workflow: {
         queueName: CLASSIFICATION_WORKFLOW_QUEUES.deriveKeywords,
         workflowName: CLASSIFICATION_WORKFLOWS.deriveKeywords,
         workflowID: buildDeriveKeywordsWorkflowId(input),
      },
      payload: input,
   });
   return matchDbosQueueResult(queued, {
      err: (
         cause,
      ): Result<DbosWorkflowHandle, ClassificationWorkflowQueueError> =>
         err(
            new ClassificationWorkflowQueueError({
               operation: "derive_keywords",
               message:
                  "Não foi possível enfileirar a derivação de palavras-chave.",
               cause,
            }),
         ),
      ok: (
         value,
      ): Result<DbosWorkflowHandle, ClassificationWorkflowQueueError> =>
         ok(value),
   });
}
