import type { DatabaseInstance } from "@core/database/client";
import { getLogger } from "@core/logging/root";

const logger = getLogger().child({ module: "events:reconcile" });

import { currentMonthUsageByEvent } from "@core/database/schema";
import { FREE_TIER_LIMITS } from "@core/stripe/constants";
import type { Redis } from "ioredis";

export async function reconcileUsageCounters(
   db: DatabaseInstance,
   redis: Redis,
): Promise<void> {
   const startTime = Date.now();

   try {
      const rows = await db.select().from(currentMonthUsageByEvent);

      const billableEventNames = new Set(Object.keys(FREE_TIER_LIMITS));

      const orgEventCounts = new Map<string, Map<string, number>>();

      for (const row of rows) {
         if (!billableEventNames.has(row.eventName)) continue;

         if (!orgEventCounts.has(row.organizationId)) {
            orgEventCounts.set(row.organizationId, new Map());
         }
         const eventMap = orgEventCounts.get(row.organizationId)!;
         eventMap.set(row.eventName, row.eventCount);
      }

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
      logger.info(
         { organizations: orgEventCounts.size, duration },
         "Reconciled usage counters",
      );
   } catch (error) {
      logger.error({ err: error }, "Failed to reconcile usage counters");
      throw error;
   }
}
