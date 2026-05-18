import { Result, TaggedError, type Result as ResultType } from "better-result";
import {
   enqueueDbosWorkflow,
   type DbosQueueError,
   type DbosWorkflowHandle,
   matchDbosQueueResult,
   type WorkflowClient,
} from "@core/dbos/client";
import {
   buildClassifyTransactionsBatchWorkflowId,
   CLASSIFICATION_WORKFLOW_QUEUES,
   CLASSIFICATION_WORKFLOWS,
   type ClassifyTransactionsBatchInput,
} from "@modules/classification/workflows/constants";

export class ClassificationWorkflowQueueError extends TaggedError(
   "ClassificationWorkflowQueueError",
)<{
   operation: "classify_transactions";
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
      ): ResultType<DbosWorkflowHandle, ClassificationWorkflowQueueError> =>
         Result.err(
            new ClassificationWorkflowQueueError({
               operation: "classify_transactions",
               message:
                  "Não foi possível enfileirar a classificação de lançamentos.",
               cause,
            }),
         ),
      ok: (
         value,
      ): ResultType<DbosWorkflowHandle, ClassificationWorkflowQueueError> =>
         Result.ok(value),
   });
}
