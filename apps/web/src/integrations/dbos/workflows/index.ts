export { DeriveKeywordsWorkflow } from "./derive-keywords.workflow";
export { BackfillKeywordsWorkflow } from "./backfill-keywords.workflow";
export { CategorizationWorkflow } from "./categorization.workflow";

import { DeriveKeywordsWorkflow } from "./derive-keywords.workflow";
import { BackfillKeywordsWorkflow } from "./backfill-keywords.workflow";
import { CategorizationWorkflow } from "./categorization.workflow";
import { registerWorkflowClasses } from "./runner";

registerWorkflowClasses({
   DeriveKeywordsWorkflow,
   BackfillKeywordsWorkflow,
   CategorizationWorkflow,
});
