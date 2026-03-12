import {
   type BudgetAlertJobData,
   createBudgetAlertsQueue,
} from "@packages/events/queues/budget-alerts";
import { createQueueConnection } from "@packages/events/queues/connection";
import type { Queue } from "bullmq";

let _queue: Queue<BudgetAlertJobData> | null = null;

/**
 * Returns a lazy-initialized budget alerts queue instance.
 * Returns null if REDIS_URL is not set (e.g. during build/SSG).
 */
export function getBudgetAlertsQueue(): Queue<BudgetAlertJobData> | null {
   if (_queue) return _queue;
   try {
      const redisUrl = process.env.REDIS_URL;
      if (!redisUrl) return null;
      const connection = createQueueConnection(redisUrl);
      _queue = createBudgetAlertsQueue(connection);
      return _queue;
   } catch {
      return null;
   }
}
