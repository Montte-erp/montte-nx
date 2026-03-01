import type { ConnectionOptions } from "bullmq";
import { Queue } from "bullmq";

export const BUDGET_ALERTS_QUEUE = "budget-alerts";

export interface BudgetAlertJobData {
   teamId: string;
   month: number;
   year: number;
}

/**
 * Create the budget alerts queue (producer side).
 * Call this from any app that needs to enqueue budget alert checks.
 */
export function createBudgetAlertsQueue(
   connection: ConnectionOptions,
): Queue<BudgetAlertJobData> {
   return new Queue<BudgetAlertJobData>(BUDGET_ALERTS_QUEUE, {
      connection,
      defaultJobOptions: {
         attempts: 3,
         backoff: { type: "exponential", delay: 30_000 },
         removeOnComplete: { count: 500 },
         removeOnFail: { count: 1000 },
      },
   });
}
