import { DBOS } from "@dbos-inc/dbos-sdk";
import {
   getGoalsForAlertCheck,
   markAlertSent,
} from "@core/database/repositories/budget-goals-repository";
import { teamMember, user, team } from "@core/database/schema";
import { env } from "@core/environment/web";
import { createEmitFn } from "@packages/events/emit";
import { emitFinanceBudgetAlertTriggered } from "@packages/events/finance";
import { getLogger } from "@core/logging/root";
import {
   getResendClient,
   sendBudgetAlertEmail,
} from "@core/transactional/client";
import { eq } from "drizzle-orm";
import { db } from "../singletons";

const logger = getLogger().child({ module: "workflow:budget-alerts" });

const fmt = (v: string | number) =>
   new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
   }).format(Number(v));

export interface BudgetAlertInput {
   teamId: string;
   month: number;
   year: number;
}

export class BudgetAlertsWorkflow {
   @DBOS.step()
   static async processAlerts(input: BudgetAlertInput): Promise<void> {
      const { month, year } = input;
      const goals = await getGoalsForAlertCheck(db, month, year);

      if (goals.length === 0) {
         logger.info({ month, year }, "No budget goals to alert");
         return;
      }

      const resendApiKey = env.RESEND_API_KEY;
      if (!resendApiKey) {
         logger.error("RESEND_API_KEY not set — skipping budget alert emails");
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
            const categoryName = goal.categoryName ?? "Geral";

            const members = await db
               .select({ email: user.email, name: user.name })
               .from(teamMember)
               .innerJoin(user, eq(user.id, teamMember.userId))
               .where(eq(teamMember.teamId, goal.teamId));

            const [teamRow] = await db
               .select({ organizationId: team.organizationId })
               .from(team)
               .where(eq(team.id, goal.teamId));

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

            await markAlertSent(db, goal.id, goal.teamId);

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
                     percentUsed: goal.percentUsed,
                     teamId: goal.teamId,
                  },
               );
            }

            logger.info({ goalId: goal.id, categoryName }, "Budget alert sent");
         } catch (err) {
            logger.error(
               { err, goalId: goal.id },
               "Failed to process budget alert",
            );
         }
      }
   }

   @DBOS.workflow()
   static async run(input: BudgetAlertInput): Promise<void> {
      await BudgetAlertsWorkflow.processAlerts(input);
   }
}
