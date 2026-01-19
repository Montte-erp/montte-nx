import type { DatabaseInstance } from "@packages/database/client";
import { getBudgetsWithProgress } from "@packages/database/repositories/budget-repository";
import {
   type BudgetEventInput,
   emitBudgetOverspentEvent,
   emitBudgetThresholdEvent,
} from "./queue/producer";

interface WorkflowBudgetAlertConfig {
   db: DatabaseInstance;
   organizationId: string;
}

interface WorkflowBudgetEventResult {
   budgetId: string;
   budgetName: string;
   percentage: number;
   eventType: "budget.threshold_reached" | "budget.overspent";
   emitted: boolean;
}

/**
 * Emits workflow events for budgets that have reached thresholds or are overspent.
 * This is separate from push notifications - it triggers workflow automations.
 */
export async function emitBudgetWorkflowEvents(
   config: WorkflowBudgetAlertConfig,
): Promise<WorkflowBudgetEventResult[]> {
   const { db, organizationId } = config;
   const results: WorkflowBudgetEventResult[] = [];

   try {
      const budgets = await getBudgetsWithProgress(db, organizationId);

      for (const budget of budgets) {
         if (!budget.isActive) continue;

         const percentage = budget.progress?.percentage ?? 0;
         const periodStart = budget.currentPeriod?.periodStart ?? new Date();
         const periodEnd = budget.currentPeriod?.periodEnd ?? new Date();

         const eventInput: BudgetEventInput = {
            budgetId: budget.id,
            budgetName: budget.name,
            limit: parseFloat(budget.amount),
            organizationId,
            percentUsed: percentage,
            periodEnd: periodEnd.toISOString(),
            periodId: budget.currentPeriod?.id,
            periodStart: periodStart.toISOString(),
            spent: budget.progress.spent,
         };

         // Check for overspent (100%+)
         if (percentage >= 100) {
            try {
               await emitBudgetOverspentEvent({
                  ...eventInput,
                  threshold: 100,
               });
               results.push({
                  budgetId: budget.id,
                  budgetName: budget.name,
                  emitted: true,
                  eventType: "budget.overspent",
                  percentage,
               });
            } catch (err) {
               console.error(
                  `[BudgetWorkflowEvents] Error emitting overspent event for ${budget.id}:`,
                  err,
               );
               results.push({
                  budgetId: budget.id,
                  budgetName: budget.name,
                  emitted: false,
                  eventType: "budget.overspent",
                  percentage,
               });
            }
         }
         // Check for threshold reached (80%+)
         else if (percentage >= 80) {
            try {
               await emitBudgetThresholdEvent({
                  ...eventInput,
                  threshold: 80,
               });
               results.push({
                  budgetId: budget.id,
                  budgetName: budget.name,
                  emitted: true,
                  eventType: "budget.threshold_reached",
                  percentage,
               });
            } catch (err) {
               console.error(
                  `[BudgetWorkflowEvents] Error emitting threshold event for ${budget.id}:`,
                  err,
               );
               results.push({
                  budgetId: budget.id,
                  budgetName: budget.name,
                  emitted: false,
                  eventType: "budget.threshold_reached",
                  percentage,
               });
            }
         }
      }
   } catch (err) {
      console.error("[BudgetWorkflowEvents] Error checking budgets:", err);
   }

   return results;
}
