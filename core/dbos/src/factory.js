import { WorkflowQueue } from "@dbos-inc/dbos-sdk";
export function createQueue(name, options) {
   return new WorkflowQueue(`workflow:${name}`, options);
}
export function createQueues(names, options) {
   return names.map((name) => createQueue(name, options));
}
export function createEnqueuer(workflowName, queueName, getWorkflowId) {
   return (client, input) =>
      client.enqueue(
         {
            workflowName,
            queueName: `workflow:${queueName}`,
            ...(getWorkflowId && { workflowID: getWorkflowId(input) }),
         },
         input,
      );
}
