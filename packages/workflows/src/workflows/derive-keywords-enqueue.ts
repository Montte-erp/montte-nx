import type { DBOSClient } from "@dbos-inc/dbos-sdk";
import {
   DERIVE_KEYWORDS_QUEUE_NAME,
   type DeriveKeywordsInput,
} from "./derive-keywords-workflow";

export type { DeriveKeywordsInput };

export async function enqueueDeriveKeywordsWorkflow(
   client: DBOSClient,
   input: DeriveKeywordsInput,
) {
   await client.enqueue(
      {
         workflowName: "deriveKeywordsWorkflowFn",
         queueName: DERIVE_KEYWORDS_QUEUE_NAME,
      },
      input,
   );
}
