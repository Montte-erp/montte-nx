import type { DatabaseInstance } from "@core/database/client";
import { refreshUsageViews } from "@packages/events/refresh-views";
import { getLogger } from "@core/logging/root";

const logger = getLogger().child({ module: "job:views" });

export async function runRefreshViews(db: DatabaseInstance): Promise<void> {
   const startTime = Date.now();
   logger.info("Starting materialized view refresh...");

   await refreshUsageViews(db);

   const duration = Date.now() - startTime;
   logger.info({ durationMs: duration }, "Materialized views refreshed");
}
