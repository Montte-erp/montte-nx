import { Result, TaggedError, type Result as ResultType } from "better-result";
import {
   enqueueDbosWorkflow,
   type DbosQueueError,
   type DbosWorkflowHandle,
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

export class ClassificationWorkflowQueueError extends TaggedError(
   "ClassificationWorkflowQueueError",
)<{
   operation: "classify_transactions" | "derive_keywords";
   message: string;
   cause: DbosQueueError;
}>() {}

export function isClassificationWorkflowQueueFailure<T>(
   result: ResultType<T, ClassificationWorkflowQueueError>,
) {
   return Result.isError(result);
}

export async function enqueueClassifyTransactionsBatchWorkflow(
   client: WorkflowClient,
   input: ClassifyTransactionsBatchInput,
): Promise<ResultType<DbosWorkflowHandle, ClassificationWorkflowQueueError>> {
   const queued = await enqueueDbosWorkflow({
      client,
      queueName: CLASSIFICATION_WORKFLOW_QUEUES.classify,
      queueOptions: { workerConcurrency: 10 },
      workflow: {
         queueName: CLASSIFICATION_WORKFLOW_QUEUES.classify,
         workflowName: CLASSIFICATION_WORKFLOWS.classifyTransactionsBatch,
         workflowID: buildClassifyTransactionsBatchWorkflowId(input),
      },
      payload: input,
   });
   if (Result.isError(queued)) {
      return Result.err(
         new ClassificationWorkflowQueueError({
            operation: "classify_transactions",
            message:
               "Não foi possível enfileirar a classificação de lançamentos.",
            cause: queued.error,
         }),
      );
   }

   return Result.ok(queued.value);
}

export async function enqueueDeriveKeywordsWorkflow(
   client: WorkflowClient,
   input: DeriveKeywordsWorkflowInput,
): Promise<ResultType<DbosWorkflowHandle, ClassificationWorkflowQueueError>> {
   const queued = await enqueueDbosWorkflow({
      client,
      queueName: CLASSIFICATION_WORKFLOW_QUEUES.deriveKeywords,
      queueOptions: { workerConcurrency: 10 },
      workflow: {
         queueName: CLASSIFICATION_WORKFLOW_QUEUES.deriveKeywords,
         workflowName: CLASSIFICATION_WORKFLOWS.deriveKeywords,
         workflowID: buildDeriveKeywordsWorkflowId(input),
      },
      payload: input,
   });
   if (Result.isError(queued)) {
      return Result.err(
         new ClassificationWorkflowQueueError({
            operation: "derive_keywords",
            message:
               "Não foi possível enfileirar a derivação de palavras-chave.",
            cause: queued.error,
         }),
      );
   }

   return Result.ok(queued.value);
}
