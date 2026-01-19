import type { DatabaseInstance } from "@packages/database/client";
import {
   getBudgetsWithProgress,
   updateBudget,
} from "@packages/database/repositories/budget-repository";
import { shouldSendNotification } from "@packages/database/repositories/notification-preferences-repository";
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

interface PredictiveAlertResult {
   budgetId: string;
   budgetName: string;
   currentPercentage: number;
   projectedPercentage: number;
   daysRemaining: number;
   projectedOverspend: number;
   notificationSent: boolean;
}

/**
 * Calculate projected end-of-period spending based on current spending rate
 */
function calculateProjectedSpending(
   spent: number,
   periodStart: Date,
   periodEnd: Date,
   limit: number,
): {
   projectedPercentage: number;
   projectedOverspend: number;
   daysRemaining: number;
} {
   const now = new Date();
   const daysElapsed = Math.max(
      1,
      (now.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24),
   );
   const daysRemaining = Math.max(
      0,
      (periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
   );

   // Daily spending rate
   const dailyRate = spent / daysElapsed;

   // Projected total spending by end of period
   const projectedTotal = spent + dailyRate * daysRemaining;

   // Projected percentage and overspend
   const projectedPercentage = limit > 0 ? (projectedTotal / limit) * 100 : 0;
   const projectedOverspend = Math.max(0, projectedTotal - limit);

   return {
      daysRemaining: Math.round(daysRemaining),
      projectedOverspend,
      projectedPercentage,
   };
}

/**
 * Check for predictive budget alerts - warns users before they exceed their budget
 */
export async function checkPredictiveBudgetAlerts(
   config: BudgetAlertConfig,
): Promise<PredictiveAlertResult[]> {
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
   const results: PredictiveAlertResult[] = [];

   for (const budget of budgets) {
      if (!budget.isActive || !budget.alertConfig?.enabled) {
         continue;
      }

      const percentage = budget.progress?.percentage ?? 0;
      const limit = parseFloat(budget.amount);
      const periodStart = budget.currentPeriod?.periodStart ?? new Date();
      const periodEnd = budget.currentPeriod?.periodEnd ?? new Date();

      // Skip if already over budget (handled by regular alerts)
      if (percentage >= 100) {
         continue;
      }

      // Skip if under 50% (too early to predict)
      if (percentage < 50) {
         continue;
      }

      const { projectedPercentage, projectedOverspend, daysRemaining } =
         calculateProjectedSpending(
            budget.progress.spent,
            periodStart,
            periodEnd,
            limit,
         );

      // Only alert if projected to exceed budget and not already notified for prediction
      const predictiveAlertSent =
         budget.alertConfig.predictiveAlertSent ?? false;

      if (
         projectedPercentage >= 100 &&
         !predictiveAlertSent &&
         daysRemaining > 0
      ) {
         const payload = createNotificationPayload("budget_prediction", {
            body: `${budget.name}: Baseado no ritmo atual de gastos, você deve ultrapassar o orçamento em ${daysRemaining} dias. Projeção: ${projectedPercentage.toFixed(0)}%`,
            metadata: {
               budgetId: budget.id,
               currentPercentage: percentage,
               daysRemaining,
               projectedOverspend,
               projectedPercentage,
            },
            title: "Alerta Preditivo de Orçamento",
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
            // Mark predictive alert as sent
            await updateBudget(db, budget.id, {
               alertConfig: {
                  ...budget.alertConfig,
                  predictiveAlertSent: true,
                  predictiveAlertSentAt: new Date(),
               },
            });
         }

         results.push({
            budgetId: budget.id,
            budgetName: budget.name,
            currentPercentage: percentage,
            daysRemaining,
            notificationSent: result.success,
            projectedOverspend,
            projectedPercentage,
         });
      }
   }

   return results;
}

/**
 * Reset predictive alert flag when a new budget period starts
 */
export async function resetPredictiveAlert(
   db: DatabaseInstance,
   budgetId: string,
): Promise<void> {
   const budget = await db.query.budget.findFirst({
      where: (b, { eq }) => eq(b.id, budgetId),
   });

   if (!budget?.alertConfig) {
      return;
   }

   await updateBudget(db, budgetId, {
      alertConfig: {
         ...budget.alertConfig,
         predictiveAlertSent: false,
         predictiveAlertSentAt: undefined,
      },
   });
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
