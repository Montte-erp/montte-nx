import { DBOS } from "@dbos-inc/dbos-sdk";
import { getLogger } from "@core/logging/root";
import type { CategorizationWorkflow } from "./categorization.workflow";
import type { CategorizationInput } from "./categorization.workflow";
import type { DeriveKeywordsWorkflow } from "./derive-keywords.workflow";
import type { DeriveKeywordsInput } from "./derive-keywords.workflow";
import type { BackfillKeywordsWorkflow } from "./backfill-keywords.workflow";
import type { ImportBatchWorkflow } from "./import-batch.workflow";
import type { ImportBatchInput } from "./import-batch.workflow";

const logger = getLogger().child({ module: "dbos.runner" });

type WorkflowClasses = {
   CategorizationWorkflow: typeof CategorizationWorkflow;
   DeriveKeywordsWorkflow: typeof DeriveKeywordsWorkflow;
   BackfillKeywordsWorkflow: typeof BackfillKeywordsWorkflow;
   ImportBatchWorkflow: typeof ImportBatchWorkflow;
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

export function startImportBatchWorkflow(input: ImportBatchInput): void {
   if (!registry.ImportBatchWorkflow) return;
   void DBOS.startWorkflow(registry.ImportBatchWorkflow, {
      workflowID: `import-batch-${input.teamId}-${input.importId}`,
   })
      .run(input)
      .catch((err) => {
         logger.error(
            { err, teamId: input.teamId, importId: input.importId },
            "Failed to start import-batch workflow",
         );
      });
}
