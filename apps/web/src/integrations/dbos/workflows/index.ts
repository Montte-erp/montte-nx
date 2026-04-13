export { DeriveKeywordsWorkflow } from "./derive-keywords.workflow";
export { BackfillKeywordsWorkflow } from "./backfill-keywords.workflow";
export { CategorizationWorkflow } from "./categorization.workflow";

import { DeriveKeywordsWorkflow } from "./derive-keywords.workflow";
import { CategorizationWorkflow } from "./categorization.workflow";
import { registerWorkflowClasses } from "./runner";

registerWorkflowClasses({ DeriveKeywordsWorkflow, CategorizationWorkflow });

// DBOS decorators must register before DBOS.launch(). HMR partial re-evaluation
// re-applies decorators on an already-launched instance → crash.
// Declining HMR forces a full reload when workflow files change.
if (import.meta.hot) {
   import.meta.hot.decline();
}
