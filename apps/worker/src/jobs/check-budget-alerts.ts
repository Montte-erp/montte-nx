import type { DatabaseInstance } from "@packages/database/client";
import {
	getGoalsForAlertCheck,
	updateBudgetGoal,
} from "@packages/database/repositories/budget-goals-repository";
import { teamMember, user, team } from "@packages/database/schema";
import { env } from "@packages/environment/worker";
import { createEmitFn } from "@packages/events/emit";
import { emitFinanceBudgetAlertTriggered } from "@packages/events/finance";
import type { BudgetAlertJobData } from "@packages/queue/budget-alerts";
import {
	getResendClient,
	sendBudgetAlertEmail,
} from "@packages/transactional/client";
import { eq } from "drizzle-orm";

const fmt = (n: number) =>
	new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
		n,
	);

export async function checkBudgetAlerts(
	db: DatabaseInstance,
	job: BudgetAlertJobData,
): Promise<void> {
	try {
		const { month, year } = job;

		const goals = await getGoalsForAlertCheck(db, { month, year });

		if (goals.length === 0) {
			console.log(
				`[Worker] No budget goals to alert for ${month}/${year}`,
			);
			return;
		}

		console.log(
			`[Worker] Found ${goals.length} budget goal(s) to alert for ${month}/${year}`,
		);

		const resendApiKey = env.RESEND_API_KEY;
		if (!resendApiKey) {
			console.error(
				"[Worker] RESEND_API_KEY is not set — skipping budget alert emails",
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
						console.error(
							`[Worker] Failed to send budget alert email to ${member.email}:`,
							err,
						);
					});
				}

				// Mark alert as sent
				await updateBudgetGoal(
					db,
					{ id: goal.id, teamId: goal.teamId },
					{ alertSentAt: new Date() },
				);

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

				console.log(
					`[Worker] Budget alert sent for goal ${goal.id} (${categoryName}, ${goal.percentUsed}%)`,
				);
			} catch (err) {
				console.error(
					`[Worker] Failed to process budget alert for goal ${goal.id}:`,
					err,
				);
			}
		}
	} catch (err) {
		console.error("[Worker] checkBudgetAlerts failed:", err);
	}
}
