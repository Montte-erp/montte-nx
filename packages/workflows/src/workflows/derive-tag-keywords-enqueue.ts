import type { DBOSClient } from "@dbos-inc/dbos-sdk";

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
): Promise<void> {
   await client.enqueue(
      {
         workflowName: "deriveTagKeywordsWorkflowFn",
         queueName: "workflow:derive-tag-keywords",
      },
      input,
   );
}
