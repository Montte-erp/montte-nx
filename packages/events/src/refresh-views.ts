import type { DatabaseInstance } from "@core/database/client";
import { getLogger } from "@core/logging/root";

const logger = getLogger().child({ module: "events:views" });

import {
   currentMonthStorageCost,
   currentMonthUsageByCategory,
   currentMonthUsageByEvent,
   dailyEventCounts,
   dailyUsageByEvent,
   monthlyAiUsage,
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
         db.refreshMaterializedView(dailyUsageByEvent).concurrently(),
         db.refreshMaterializedView(currentMonthUsageByEvent).concurrently(),
         db.refreshMaterializedView(currentMonthUsageByCategory).concurrently(),
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
