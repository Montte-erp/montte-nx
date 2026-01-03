import type { DatabaseInstance } from "@packages/database/client";
import {
   getBudgetsWithProgress,
   updateBudget,
} from "@packages/database/repositories/budget-repository";
import { shouldSendNotification } from "@packages/database/repositories/notification-preferences-repository";
import {
   emitBudgetOverspentEvent,
   emitBudgetThresholdEvent,
   type BudgetEventInput,
} from "@packages/workflows/queue/producer";
import { createNotificationPayload, sendPushNotificationToUser } from "./push";

interface BudgetAlertConfig {
   db: DatabaseInstance;
   organizationId: string;
   userId: string;
   vapidPublicKey?: string;
   vapidPrivateKey?: string;
   vapidSubject?: string;
}

interface AlertResult {
   budgetId: string;
   budgetName: string;
   percentage: number;
   threshold: number;
   notificationSent: boolean;
}

export async function checkBudgetAlertsAfterTransaction(
   config: BudgetAlertConfig,
): Promise<AlertResult[]> {
   const {
      db,
      organizationId,
      userId,
      vapidPublicKey,
      vapidPrivateKey,
      vapidSubject,
   } = config;

   if (!vapidPublicKey || !vapidPrivateKey) {
      return [];
   }

   const shouldNotify = await shouldSendNotification(
      db,
      userId,
      "budgetAlerts",
   );
   if (!shouldNotify) {
      return [];
   }

   const budgets = await getBudgetsWithProgress(db, organizationId);
   const results: AlertResult[] = [];

   for (const budget of budgets) {
      if (!budget.isActive || !budget.alertConfig?.enabled) {
         continue;
      }

      const percentage = budget.progress?.percentage ?? 0;
      const thresholds = budget.alertConfig.thresholds || [];

      for (const threshold of thresholds) {
         if (percentage >= threshold.percentage && !threshold.notified) {
            const payload = createNotificationPayload("budget_alert", {
               body: `${budget.name} atingiu ${percentage.toFixed(0)}% do limite (${threshold.percentage}% configurado)`,
               metadata: {
                  budgetId: budget.id,
                  percentage,
                  threshold: threshold.percentage,
               },
               title: "Alerta de Orçamento",
               url: `/budgets/${budget.id}`,
            });

            const result = await sendPushNotificationToUser({
               db,
               payload,
               userId,
               vapidPrivateKey,
               vapidPublicKey,
               vapidSubject: vapidSubject || "mailto:admin@montte.co",
            });

            if (result.success) {
               const updatedThresholds = thresholds.map((t) =>
                  t.percentage === threshold.percentage
                     ? { ...t, notified: true, notifiedAt: new Date() }
                     : t,
               );

               await updateBudget(db, budget.id, {
                  alertConfig: {
                     ...budget.alertConfig,
                     thresholds: updatedThresholds,
                  },
               });
            }

            results.push({
               budgetId: budget.id,
               budgetName: budget.name,
               notificationSent: result.success,
               percentage,
               threshold: threshold.percentage,
            });
         }
      }
   }

   return results;
}

export async function resetBudgetAlertThresholds(
   db: DatabaseInstance,
   budgetId: string,
): Promise<void> {
   const budget = await db.query.budget.findFirst({
      where: (b, { eq }) => eq(b.id, budgetId),
   });

   if (!budget?.alertConfig?.thresholds) {
      return;
   }

   const resetThresholds = budget.alertConfig.thresholds.map((t) => ({
      ...t,
      notified: false,
      notifiedAt: undefined,
   }));

   await updateBudget(db, budgetId, {
      alertConfig: {
         ...budget.alertConfig,
         thresholds: resetThresholds,
      },
   });
}

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
               console.error(`[BudgetWorkflowEvents] Error emitting overspent event for ${budget.id}:`, err);
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
               console.error(`[BudgetWorkflowEvents] Error emitting threshold event for ${budget.id}:`, err);
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
