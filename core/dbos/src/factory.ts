import type { DBOSClient } from "@dbos-inc/dbos-sdk";
import { WorkflowQueue } from "@dbos-inc/dbos-sdk";

export function createQueue(
   name: string,
   options: { workerConcurrency: number },
) {
   return new WorkflowQueue(`workflow:${name}`, options);
}

export function createQueues(
   names: readonly string[],
   options: { workerConcurrency: number },
) {
   return names.map((name) => createQueue(name, options));
}

export function createEnqueuer<T>(
   workflowName: string,
   queueName: string,
   getWorkflowId?: (input: T) => string,
) {
   return (client: DBOSClient, input: T) =>
      client.enqueue(
         {
            workflowName,
            queueName: `workflow:${queueName}`,
            ...(getWorkflowId && { workflowID: getWorkflowId(input) }),
         },
         input,
      );
}
