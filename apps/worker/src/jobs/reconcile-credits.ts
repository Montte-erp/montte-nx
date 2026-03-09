import type { DatabaseInstance } from "@core/database/client";
import { reconcileUsageCounters } from "@packages/events/reconcile";
import { getLogger } from "@core/logging/root";
import type { Redis } from "ioredis";

const logger = getLogger().child({ module: "job:reconcile" });

export async function runReconcileCredits(
   db: DatabaseInstance,
   redis: Redis,
): Promise<void> {
   const startTime = Date.now();
   logger.info("Starting usage counter reconciliation...");

   await reconcileUsageCounters(db, redis);

   const duration = Date.now() - startTime;
   logger.info({ durationMs: duration }, "Usage counters reconciled");
}
