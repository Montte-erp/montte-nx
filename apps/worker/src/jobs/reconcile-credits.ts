import type { DatabaseInstance } from "@packages/database/client";
import { reconcileUsageCounters } from "@packages/events/reconcile";
import type { Redis } from "ioredis";

export async function runReconcileCredits(
	db: DatabaseInstance,
	redis: Redis,
): Promise<void> {
	const startTime = Date.now();
	console.log("[Worker] Starting usage counter reconciliation...");

	await reconcileUsageCounters(db, redis);

	const duration = Date.now() - startTime;
	console.log(`[Worker] Usage counters reconciled in ${duration}ms`);
}
