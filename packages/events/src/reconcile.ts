import type { DatabaseInstance } from "@packages/database/client";
import { getLogger } from "@packages/logging/root";

const logger = getLogger().child({ module: "events:reconcile" });
import { currentMonthUsageByEvent } from "@packages/database/schema";
import { FREE_TIER_LIMITS } from "@packages/stripe/constants";
import type { Redis } from "ioredis";

/**
 * Reconcile Redis per-product usage counters with materialized view data.
 * Called hourly after refreshUsageViews().
 *
 * 1. Query current_month_usage_by_event for all orgs
 * 2. For each billable event, SET Redis counter to actual event count
 * 3. Refresh TTL to end of current month
 */
export async function reconcileUsageCounters(
   db: DatabaseInstance,
   redis: Redis,
): Promise<void> {
   const startTime = Date.now();

   try {
      // Query all current month usage grouped by org and event name
      const rows = await db.select().from(currentMonthUsageByEvent);

      // Only reconcile events that have a free tier limit (billable events)
      const billableEventNames = new Set(Object.keys(FREE_TIER_LIMITS));

      // Group counts by org + event
      const orgEventCounts = new Map<string, Map<string, number>>();

      for (const row of rows) {
         if (!billableEventNames.has(row.eventName)) continue;

         if (!orgEventCounts.has(row.organizationId)) {
            orgEventCounts.set(row.organizationId, new Map());
         }
         const eventMap = orgEventCounts.get(row.organizationId)!;
         eventMap.set(row.eventName, row.eventCount);
      }

      // SET Redis counters to match materialized view data
      const pipeline = redis.pipeline();

      const now = new Date();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const ttlMs =
         new Date(endOfMonth.getTime() + 86_400_000).getTime() - now.getTime();

      for (const [orgId, eventMap] of orgEventCounts) {
         for (const [eventName, count] of eventMap) {
            const key = `usage:${orgId}:${eventName}`;
            pipeline.set(key, count.toString());
            pipeline.pexpire(key, ttlMs);
         }
      }

      await pipeline.exec();

      const duration = Date.now() - startTime;
      logger.info({ organizations: orgEventCounts.size, duration }, "Reconciled usage counters");
   } catch (error) {
      logger.error({ err: error }, "Failed to reconcile usage counters");
      throw error;
   }
}
