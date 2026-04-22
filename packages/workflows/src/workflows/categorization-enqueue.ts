import type { DBOSClient } from "@dbos-inc/dbos-sdk";
import {
   CATEGORIZATION_QUEUE_NAME,
   type CategorizationInput,
} from "./categorization-workflow";

export type { CategorizationInput };

export async function enqueueCategorizationWorkflow(
   client: DBOSClient,
   input: CategorizationInput,
) {
   await client.enqueue(
      {
         workflowName: "categorizationWorkflowFn",
         queueName: CATEGORIZATION_QUEUE_NAME,
         workflowID: `categorize-${input.transactionId}`,
      },
      input,
   );
}
