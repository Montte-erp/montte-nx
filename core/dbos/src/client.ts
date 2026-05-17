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
   minPollingIntervalMs?: number;
   onConflict?: "update_if_latest_version" | "always_update" | "never_update";
   partitionQueue?: boolean;
   priorityEnabled?: boolean;
   rateLimit?: {
      limitPerPeriod: number;
      periodSec: number;
   };
   workerConcurrency?: number;
};

export class DbosQueueError extends TaggedError("DbosQueueError")<{
   operation: "create_client" | "register_queue" | "enqueue_workflow";
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
   let client: ResultType<WorkflowClient, DbosQueueError>;
   if (input.client) {
      client = Result.ok(input.client);
   } else if (input.systemDatabaseUrl) {
      client = await getDbosClient(input.systemDatabaseUrl);
   } else {
      client = Result.err(
         new DbosQueueError({
            operation: "create_client",
            queueName: input.queueName,
            message: "Cliente DBOS não informado para enfileirar workflow.",
         }),
      );
   }
   if (Result.isError(client)) return client;

   const onConflict = input.queueOptions?.onConflict ?? "always_update";
   const registered = await Result.tryPromise({
      try: () =>
         client.value.registerQueue(input.queueName, {
            ...input.queueOptions,
            onConflict,
         }),
      catch: (cause) =>
         new DbosQueueError({
            operation: "register_queue",
            queueName: input.queueName,
            message: "Não foi possível registrar a fila DBOS.",
            cause,
         }),
   });
   if (Result.isError(registered)) return Result.err(registered.error);

   return Result.ok(client.value);
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
