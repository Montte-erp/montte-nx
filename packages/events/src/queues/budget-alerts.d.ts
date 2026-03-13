import type { ConnectionOptions } from "bullmq";
import { Queue } from "bullmq";
export declare const BUDGET_ALERTS_QUEUE = "budget-alerts";
export interface BudgetAlertJobData {
   teamId: string;
   month: number;
   year: number;
}
export declare function createBudgetAlertsQueue(
   connection: ConnectionOptions,
): Queue<BudgetAlertJobData>;
//# sourceMappingURL=budget-alerts.d.ts.map
