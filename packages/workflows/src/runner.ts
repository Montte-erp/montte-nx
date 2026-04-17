import { DBOS } from "@dbos-inc/dbos-sdk";
import { getLogger } from "@core/logging/root";
import { categorizationWorkflow } from "./workflows/categorization.workflow";
import { deriveKeywordsWorkflow } from "./workflows/derive-keywords.workflow";
import type { CategorizationInput } from "./workflows/categorization.workflow";
import type { DeriveKeywordsInput } from "./workflows/derive-keywords.workflow";

export type { CategorizationInput, DeriveKeywordsInput };

const logger = getLogger().child({ module: "dbos.runner" });

export function startCategorizationWorkflow(input: CategorizationInput): void {
   void DBOS.startWorkflow(categorizationWorkflow, {
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
   void DBOS.startWorkflow(deriveKeywordsWorkflow)
      .run(input)
      .catch((err) => {
         logger.error(
            { err, categoryId: input.categoryId },
            "Failed to start derive-keywords workflow",
         );
      });
}
