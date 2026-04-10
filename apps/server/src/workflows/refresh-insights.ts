import { DBOS } from "@dbos-inc/dbos-sdk";
import { fromPromise } from "neverthrow";
import { computeInsightData } from "@packages/analytics/compute-insight";
import { insights } from "@core/database/schemas/insights";
import { getLogger } from "@core/logging/root";
import { eq } from "drizzle-orm";
import { db } from "../singletons";

const logger = getLogger().child({ module: "workflow:insights" });

export class RefreshInsightsWorkflow {
   @DBOS.step()
   static async refreshAll(): Promise<void> {
      const startTime = Date.now();
      const allInsights = await db.select().from(insights);
      logger.info({ count: allInsights.length }, "Refreshing insights");

      const results = await Promise.all(
         allInsights.map((insight) =>
            fromPromise(
               computeInsightData(db, insight).then((freshData) =>
                  db
                     .update(insights)
                     .set({
                        cachedResults: freshData,
                        lastComputedAt: new Date(),
                     })
                     .where(eq(insights.id, insight.id)),
               ),
               (error) => ({ insightId: insight.id, error }),
            ),
         ),
      );

      const successCount = results.filter((r) => r.isOk()).length;
      const failureCount = results.filter((r) => r.isErr()).length;

      for (const result of results) {
         if (result.isErr()) {
            logger.error(
               { err: result.error.error, insightId: result.error.insightId },
               "Failed to refresh insight",
            );
         }
      }

      logger.info(
         { durationMs: Date.now() - startTime, successCount, failureCount },
         "Insight refresh complete",
      );
   }

   @DBOS.scheduled({ crontab: "0 */3 * * *" })
   @DBOS.workflow()
   static async run(_scheduledTime: Date, _startTime: Date): Promise<void> {
      await RefreshInsightsWorkflow.refreshAll();
   }
}
