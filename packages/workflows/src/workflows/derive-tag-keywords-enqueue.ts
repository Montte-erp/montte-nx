import type { DBOSClient } from "@dbos-inc/dbos-sdk";
import { DERIVE_TAG_KEYWORDS_QUEUE_NAME } from "./derive-tag-keywords-workflow";

export type DeriveTagKeywordsInput = {
   tagId: string;
   teamId: string;
   organizationId: string;
   name: string;
   description?: string | null;
   userId?: string;
   stripeCustomerId?: string | null;
};

export async function enqueueDeriveTagKeywordsWorkflow(
   client: DBOSClient,
   input: DeriveTagKeywordsInput,
) {
   await client.enqueue(
      {
         workflowName: "deriveTagKeywordsWorkflowFn",
         queueName: DERIVE_TAG_KEYWORDS_QUEUE_NAME,
      },
      input,
   );
}
