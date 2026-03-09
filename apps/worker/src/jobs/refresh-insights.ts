import { computeInsightData } from "@packages/analytics/compute-insight";
import type { DatabaseInstance } from "@core/database/client";
import { insights } from "@core/database/schemas/insights";
import { getLogger } from "@core/logging/root";
import { eq } from "drizzle-orm";

const logger = getLogger().child({ module: "job:insights" });

/**
 * Background job that refreshes cached results for all insights.
 * Runs every 3 hours to keep dashboard data up-to-date without blocking UI.
 */
export async function runRefreshInsights(db: DatabaseInstance): Promise<void> {
   const startTime = Date.now();
   logger.info("Starting insight cache refresh...");

   try {
      // Fetch all insights
      const allInsights = await db.select().from(insights);

      logger.info({ count: allInsights.length }, "Found insights to refresh");

      let successCount = 0;
      let failureCount = 0;

      // Refresh each insight sequentially to avoid overwhelming the database
      for (const insight of allInsights) {
         try {
            const freshData = await computeInsightData(db, insight);

            await db
               .update(insights)
               .set({
                  cachedResults: freshData,
                  lastComputedAt: new Date(),
               })
               .where(eq(insights.id, insight.id));

            successCount++;
         } catch (error) {
            logger.error(
               { err: error, insightId: insight.id, insightName: insight.name },
               "Failed to refresh insight",
            );
            failureCount++;
         }
      }

      const duration = Date.now() - startTime;
      logger.info(
         { durationMs: duration, successCount, failureCount },
         "Insight cache refresh completed",
      );
   } catch (error) {
      logger.error({ err: error }, "Insight cache refresh failed");
      throw error;
   }
}
