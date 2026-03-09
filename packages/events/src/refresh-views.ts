import type { DatabaseInstance } from "@core/database/client";
import { getLogger } from "@core/logging/root";

const logger = getLogger().child({ module: "events:views" });

import {
   contentTrafficSources,
   currentMonthStorageCost,
   currentMonthUsageByCategory,
   currentMonthUsageByEvent,
   dailyContentAnalytics,
   dailyEventCounts,
   dailyUsageByEvent,
   monthlyAiUsage,
   monthlySdkUsage,
} from "@core/database/schema";

/**
 * Refresh all materialized views (billing + analytics).
 * Uses CONCURRENTLY to avoid blocking reads.
 * Should be called hourly via a scheduled job.
 */
export async function refreshUsageViews(db: DatabaseInstance): Promise<void> {
   const startTime = Date.now();

   try {
      await Promise.all([
         // Billing views
         db.refreshMaterializedView(dailyUsageByEvent).concurrently(),
         db.refreshMaterializedView(currentMonthUsageByEvent).concurrently(),
         db.refreshMaterializedView(currentMonthUsageByCategory).concurrently(),
         // Analytics views
         db.refreshMaterializedView(dailyContentAnalytics).concurrently(),
         db.refreshMaterializedView(contentTrafficSources).concurrently(),
         db.refreshMaterializedView(monthlySdkUsage).concurrently(),
         db.refreshMaterializedView(monthlyAiUsage).concurrently(),
         db.refreshMaterializedView(dailyEventCounts).concurrently(),
         db.refreshMaterializedView(currentMonthStorageCost).concurrently(),
      ]);

      const duration = Date.now() - startTime;
      logger.info({ duration }, "Refreshed materialized views");
   } catch (error) {
      logger.error({ err: error }, "Failed to refresh materialized views");
      throw error;
   }
}
