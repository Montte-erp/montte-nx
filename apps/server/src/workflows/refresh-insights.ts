import { DBOS } from "@dbos-inc/dbos-sdk";
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

      let successCount = 0;
      let failureCount = 0;

      for (const insight of allInsights) {
         try {
            const freshData = await computeInsightData(db, insight);
            await db
               .update(insights)
               .set({ cachedResults: freshData, lastComputedAt: new Date() })
               .where(eq(insights.id, insight.id));
            successCount++;
         } catch (error) {
            logger.error(
               { err: error, insightId: insight.id },
               "Failed to refresh insight",
            );
            failureCount++;
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
