import { DBOS } from "@dbos-inc/dbos-sdk";
import { getLogger } from "@core/logging/root";
import { initContext } from "./context";
import type { WorkflowDeps } from "./context";
import { categorizationWorkflow } from "./workflows/categorization.workflow";
import { deriveKeywordsWorkflow } from "./workflows/derive-keywords.workflow";
import { backfillKeywordsWorkflow } from "./workflows/backfill-keywords.workflow";
import type { CategorizationInput } from "./workflows/categorization.workflow";
import type { DeriveKeywordsInput } from "./workflows/derive-keywords.workflow";

export type { CategorizationInput, DeriveKeywordsInput };

type LaunchConfig = WorkflowDeps & {
   systemDatabaseUrl: string;
   logLevel?: string;
};

const logger = getLogger().child({ module: "dbos" });

export function launchDBOS({
   systemDatabaseUrl,
   logLevel,
   ...deps
}: LaunchConfig) {
   initContext(deps);

   DBOS.setConfig({
      name: "montte-web",
      systemDatabaseUrl,
      logLevel: logLevel ?? "info",
   });

   DBOS.launch()
      .then(async () => {
         logger.info("DBOS runtime started");
         await DBOS.applySchedules([
            {
               scheduleName: "backfill-keywords-daily",
               workflowFn: backfillKeywordsWorkflow,
               schedule: "0 3 * * *",
            },
         ]);
      })
      .catch((err: unknown) => {
         logger.error({ err }, "DBOS launch failed");
      });

   process.on("SIGTERM", () => void DBOS.shutdown());
   process.on("SIGINT", () => void DBOS.shutdown());
}

export function startCategorizationWorkflow(input: CategorizationInput): void {
   void DBOS.startWorkflow(categorizationWorkflow, {
      workflowID: `categorize-${input.transactionId}`,
   })(input).catch((err: unknown) => {
      logger.error(
         { err, transactionId: input.transactionId },
         "Failed to start categorization workflow",
      );
   });
}

export function startDeriveKeywordsWorkflow(input: DeriveKeywordsInput): void {
   void DBOS.startWorkflow(deriveKeywordsWorkflow)(input).catch(
      (err: unknown) => {
         logger.error(
            { err, categoryId: input.categoryId },
            "Failed to start derive-keywords workflow",
         );
      },
   );
}
