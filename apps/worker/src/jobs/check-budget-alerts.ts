import { db } from "@core/database/client";
import {
   getGoalsForAlertCheck,
   markAlertSent,
} from "@core/database/repositories/budget-goals-repository";
import { teamMember, user, team } from "@core/database/schema";
import { env } from "@core/environment/worker";
import { createEmitFn } from "@packages/events/emit";
import { emitFinanceBudgetAlertTriggered } from "@packages/events/finance";
import { getLogger } from "@core/logging/root";
import type { BudgetAlertJobData } from "@packages/events/queues/budget-alerts";
import {
   getResendClient,
   sendBudgetAlertEmail,
} from "@core/transactional/client";
import { eq } from "drizzle-orm";

const logger = getLogger().child({ module: "job:budget-alerts" });

const fmt = (v: string | number) =>
   new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
   }).format(Number(v));

export async function checkBudgetAlerts(
   job: BudgetAlertJobData,
): Promise<void> {
   try {
      const { month, year } = job;

      const goals = await getGoalsForAlertCheck(month, year);

      if (goals.length === 0) {
         logger.info({ month, year }, "No budget goals to alert");
         return;
      }

      logger.info(
         { month, year, count: goals.length },
         "Found budget goals to alert",
      );

      const resendApiKey = env.RESEND_API_KEY;
      if (!resendApiKey) {
         logger.error(
            "RESEND_API_KEY is not set — skipping budget alert emails",
         );
         return;
      }

      const resend = getResendClient(resendApiKey);
      const emit = createEmitFn(db);

      for (const goal of goals) {
         try {
            const monthName = new Date(
               goal.year,
               goal.month - 1,
               1,
            ).toLocaleDateString("pt-BR", {
               month: "long",
               year: "numeric",
            });

            const categoryName =
               goal.subcategoryName ?? goal.categoryName ?? "Geral";

            // Fetch team members' emails
            const members = await db
               .select({ email: user.email, name: user.name })
               .from(teamMember)
               .innerJoin(user, eq(user.id, teamMember.userId))
               .where(eq(teamMember.teamId, goal.teamId));

            // Fetch team to get organizationId for event emission
            const [teamRow] = await db
               .select({ organizationId: team.organizationId })
               .from(team)
               .where(eq(team.id, goal.teamId));

            // Send alert email to each member
            for (const member of members) {
               await sendBudgetAlertEmail(resend, {
                  email: member.email,
                  categoryName,
                  spentAmount: fmt(goal.spentAmount),
                  limitAmount: fmt(Number(goal.limitAmount)),
                  percentUsed: goal.percentUsed,
                  alertThreshold: goal.alertThreshold ?? 0,
                  month: monthName,
               }).catch((err: unknown) => {
                  logger.error(
                     { err, email: member.email },
                     "Failed to send budget alert email",
                  );
               });
            }

            await markAlertSent(goal.id, goal.teamId);

            // Emit finance event
            if (teamRow) {
               await emitFinanceBudgetAlertTriggered(
                  emit,
                  {
                     organizationId: teamRow.organizationId,
                     teamId: goal.teamId,
                  },
                  {
                     budgetGoalId: goal.id,
                     categoryId: goal.categoryId ?? undefined,
                     subcategoryId: goal.subcategoryId ?? undefined,
                     percentUsed: goal.percentUsed,
                     teamId: goal.teamId,
                  },
               );
            }

            logger.info(
               { goalId: goal.id, categoryName, percentUsed: goal.percentUsed },
               "Budget alert sent",
            );
         } catch (err) {
            logger.error(
               { err, goalId: goal.id },
               "Failed to process budget alert",
            );
         }
      }
   } catch (err) {
      logger.error({ err }, "checkBudgetAlerts failed");
   }
}
