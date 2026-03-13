import { AppError, propagateError } from "@core/logging/errors";
import { eq, sql } from "drizzle-orm";
import { db } from "@core/database/client";
import { organization, team, teamMember } from "@core/database/schemas/auth";
import { bankAccounts } from "@core/database/schemas/bank-accounts";
import { categories } from "@core/database/schemas/categories";
import { insights } from "@core/database/schemas/insights";
import { transactions } from "@core/database/schemas/transactions";

export async function insertTeamMember(teamId: string, userId: string) {
   try {
      await db.insert(teamMember).values({
         teamId,
         userId,
         createdAt: new Date(),
      });
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to insert team member");
   }
}

export async function markTeamOnboardingComplete(
   teamId: string,
   data: {
      slug: string;
      accountType: string;
      onboardingProducts: string[];
   },
) {
   try {
      await db
         .update(team)
         .set({
            slug: data.slug,
            accountType: data.accountType,
            onboardingProducts: data.onboardingProducts,
            onboardingCompleted: true,
         })
         .where(eq(team.id, teamId));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to update team onboarding");
   }
}

export async function markOrganizationOnboardingComplete(
   organizationId: string,
) {
   try {
      await db
         .update(organization)
         .set({ onboardingCompleted: true })
         .where(eq(organization.id, organizationId));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to update organization onboarding");
   }
}

export async function getOrganizationById(organizationId: string) {
   try {
      return await db.query.organization.findFirst({
         where: { id: organizationId },
      });
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get organization");
   }
}

export async function getOrganizationSlug(organizationId: string) {
   try {
      return await db.query.organization.findFirst({
         where: { id: organizationId },
         columns: { slug: true },
      });
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get organization slug");
   }
}

export async function getTeamById(teamId: string) {
   try {
      return await db.query.team.findFirst({
         where: { id: teamId },
      });
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get team");
   }
}

export async function getTeamNameAndSlug(teamId: string) {
   try {
      return await db.query.team.findFirst({
         where: { id: teamId },
         columns: { name: true, slug: true },
      });
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get team");
   }
}

export async function getOnboardingCounts(
   organizationId: string,
   teamId: string,
) {
   try {
      const [insightCount, categoryCount, transactionCount, bankAccountCount] =
         await Promise.all([
            db
               .select({ count: sql<number>`count(*)` })
               .from(insights)
               .where(eq(insights.organizationId, organizationId))
               .then((rows) => Number(rows[0]?.count ?? 0)),
            db
               .select({ count: sql<number>`count(*)` })
               .from(categories)
               .where(eq(categories.teamId, teamId))
               .then((rows) => Number(rows[0]?.count ?? 0)),
            db
               .select({ count: sql<number>`count(*)` })
               .from(transactions)
               .where(eq(transactions.teamId, teamId))
               .then((rows) => Number(rows[0]?.count ?? 0)),
            db
               .select({ count: sql<number>`count(*)` })
               .from(bankAccounts)
               .where(eq(bankAccounts.teamId, teamId))
               .then((rows) => Number(rows[0]?.count ?? 0)),
         ]);

      return {
         insightCount,
         categoryCount,
         transactionCount,
         bankAccountCount,
      };
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get onboarding counts");
   }
}

export async function getOrgAndTeamOnboardingFlags(
   orgId: string,
   activeTeamId: string | null | undefined,
) {
   try {
      const org = await db.query.organization.findFirst({
         where: { id: orgId },
         columns: { id: true, slug: true, onboardingCompleted: true },
      });

      let targetTeam = activeTeamId
         ? await db.query.team.findFirst({
              where: { id: activeTeamId },
              columns: { id: true, slug: true, onboardingCompleted: true },
           })
         : null;

      if (!targetTeam) {
         targetTeam = await db.query.team.findFirst({
            where: { organizationId: orgId },
            columns: { id: true, slug: true, onboardingCompleted: true },
         });
      }

      return { org, targetTeam };
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get onboarding flags");
   }
}

export async function markTaskDone(teamId: string, taskId: string) {
   try {
      await db
         .update(team)
         .set({
            onboardingTasks: sql`COALESCE(${team.onboardingTasks}, '{}'::jsonb) || ${JSON.stringify({ [taskId]: true })}::jsonb`,
         })
         .where(eq(team.id, teamId));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to mark task done");
   }
}

export async function updateInsightCache(
   insightId: string,
   cachedResults: unknown,
) {
   try {
      await db
         .update(insights)
         .set({ cachedResults, lastComputedAt: new Date() })
         .where(eq(insights.id, insightId));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to update insight cache");
   }
}
