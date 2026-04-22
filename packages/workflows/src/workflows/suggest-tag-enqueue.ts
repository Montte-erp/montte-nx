import type { DBOSClient } from "@dbos-inc/dbos-sdk";
import {
   SUGGEST_TAG_QUEUE_NAME,
   type SuggestTagInput,
} from "./suggest-tag-workflow";

export type { SuggestTagInput };

export async function enqueueSuggestTagWorkflow(
   client: DBOSClient,
   input: SuggestTagInput,
) {
   await client.enqueue(
      {
         workflowName: "suggestTagWorkflowFn",
         queueName: SUGGEST_TAG_QUEUE_NAME,
         workflowID: `suggest-tag-${input.transactionId}`,
      },
      input,
   );
}
