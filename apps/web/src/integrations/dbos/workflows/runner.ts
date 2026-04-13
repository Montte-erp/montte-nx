import { DBOS } from "@dbos-inc/dbos-sdk";
import { getLogger } from "@core/logging/root";
import type { CategorizationInput } from "./categorization.workflow";
import type { DeriveKeywordsInput } from "./derive-keywords.workflow";

const logger = getLogger().child({ module: "dbos.runner" });

type WorkflowClasses = {
   CategorizationWorkflow: typeof import("./categorization.workflow").CategorizationWorkflow;
   DeriveKeywordsWorkflow: typeof import("./derive-keywords.workflow").DeriveKeywordsWorkflow;
};

const registry: Partial<WorkflowClasses> = {};

export function registerWorkflowClasses(classes: WorkflowClasses) {
   Object.assign(registry, classes);
}

export function startCategorizationWorkflow(input: CategorizationInput): void {
   if (!registry.CategorizationWorkflow) return;
   void DBOS.startWorkflow(registry.CategorizationWorkflow, {
      workflowID: `categorize-${input.transactionId}`,
   })
      .run(input)
      .catch((err) => {
         logger.error(
            { err, transactionId: input.transactionId },
            "Failed to start categorization workflow",
         );
      });
}

export function startDeriveKeywordsWorkflow(input: DeriveKeywordsInput): void {
   if (!registry.DeriveKeywordsWorkflow) return;
   void DBOS.startWorkflow(registry.DeriveKeywordsWorkflow)
      .run(input)
      .catch((err) => {
         logger.error(
            { err, categoryId: input.categoryId },
            "Failed to start derive-keywords workflow",
         );
      });
}
