export { DeriveKeywordsWorkflow } from "./derive-keywords.workflow";
export { BackfillKeywordsWorkflow } from "./backfill-keywords.workflow";
export { CategorizationWorkflow } from "./categorization.workflow";
export { ImportBatchWorkflow } from "./import-batch.workflow";

import { DeriveKeywordsWorkflow } from "./derive-keywords.workflow";
import { BackfillKeywordsWorkflow } from "./backfill-keywords.workflow";
import { CategorizationWorkflow } from "./categorization.workflow";
import { ImportBatchWorkflow } from "./import-batch.workflow";
import { registerWorkflowClasses } from "./runner";

registerWorkflowClasses({
   DeriveKeywordsWorkflow,
   BackfillKeywordsWorkflow,
   CategorizationWorkflow,
   ImportBatchWorkflow,
});
