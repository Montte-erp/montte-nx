import { DBOSClient } from "@dbos-inc/dbos-sdk";
import { Result, TaggedError, type Result as ResultType } from "better-result";

export function createWorkflowClient(
   systemDatabaseUrl: string,
): Promise<DBOSClient> {
   return DBOSClient.create({ systemDatabaseUrl });
}

export type WorkflowClient = DBOSClient;

export type DbosQueueOptions = {
   concurrency?: number;
   partitionQueue?: boolean;
   priorityEnabled?: boolean;
   rateLimit?: {
      limitPerPeriod: number;
      periodSec: number;
   };
   workerConcurrency?: number;
};

export class DbosQueueError extends TaggedError("DbosQueueError")<{
   operation: "create_client" | "ensure_queue" | "enqueue_workflow";
   message: string;
   queueName?: string;
   workflowName?: string;
   cause?: unknown;
}>() {}

export type DbosWorkflowHandle = {
   workflowId: string;
};

export type EnqueueDbosWorkflowInput = {
   client?: WorkflowClient;
   systemDatabaseUrl?: string;
   queueName: string;
   queueOptions?: DbosQueueOptions;
   workflow: Parameters<WorkflowClient["enqueue"]>[0];
   payload: unknown;
};

type SinglePayloadWorkflow = (payload: unknown) => Promise<unknown>;

const clientState: {
   systemDatabaseUrl?: string;
   promise?: Promise<WorkflowClient>;
} = {};

export async function getDbosClient(
   systemDatabaseUrl: string,
): Promise<ResultType<WorkflowClient, DbosQueueError>> {
   let promise = clientState.promise;
   if (!promise || clientState.systemDatabaseUrl !== systemDatabaseUrl) {
      promise = createWorkflowClient(systemDatabaseUrl);
      clientState.systemDatabaseUrl = systemDatabaseUrl;
      clientState.promise = promise;
   }

   return Result.tryPromise({
      try: () => promise,
      catch: (cause) =>
         new DbosQueueError({
            operation: "create_client",
            message: "Não foi possível criar o cliente DBOS.",
            cause,
         }),
   });
}

export async function ensureDbosQueue(input: {
   client?: WorkflowClient;
   systemDatabaseUrl?: string;
   queueName: string;
   queueOptions?: DbosQueueOptions;
}): Promise<ResultType<WorkflowClient, DbosQueueError>> {
   if (input.client) return Result.ok(input.client);

   if (!input.systemDatabaseUrl) {
      return Result.err(
         new DbosQueueError({
            operation: "ensure_queue",
            queueName: input.queueName,
            message: "Cliente DBOS não informado para enfileirar workflow.",
         }),
      );
   }

   return getDbosClient(input.systemDatabaseUrl);
}

export async function enqueueDbosWorkflow(
   input: EnqueueDbosWorkflowInput,
): Promise<ResultType<DbosWorkflowHandle, DbosQueueError>> {
   const client = await ensureDbosQueue({
      client: input.client,
      systemDatabaseUrl: input.systemDatabaseUrl,
      queueName: input.queueName,
      queueOptions: input.queueOptions,
   });
   if (Result.isError(client)) return Result.err(client.error);

   const handle = await Result.tryPromise({
      try: () =>
         client.value.enqueue<SinglePayloadWorkflow>(
            input.workflow,
            input.payload,
         ),
      catch: (cause) =>
         new DbosQueueError({
            operation: "enqueue_workflow",
            queueName: input.queueName,
            workflowName: input.workflow.workflowName,
            message: "Não foi possível enfileirar o workflow DBOS.",
            cause,
         }),
   });
   if (Result.isError(handle)) return Result.err(handle.error);

   return Result.ok({ workflowId: handle.value.workflowID });
}
