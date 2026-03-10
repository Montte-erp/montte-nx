import { ORPCError } from "@orpc/server";
import { computeInsightData } from "@packages/analytics/compute-insight";
import type { DatabaseInstance } from "@core/database/client";
import { DEFAULT_INSIGHTS } from "@core/database/default-insights";
import { createDefaultInsights } from "@core/database/repositories/dashboard-repository";
import { getInsightById } from "@core/database/repositories/insight-repository";
import { organization, team, teamMember } from "@core/database/schemas/auth";
import { bankAccounts } from "@core/database/schemas/bank-accounts";
import { categories } from "@core/database/schemas/categories";
import { dashboards } from "@core/database/schemas/dashboards";
import { insights } from "@core/database/schemas/insights";
import { transactions } from "@core/database/schemas/transactions";
import { getLogger } from "@core/logging/root";
import { createSlug } from "@core/utils/text";
import { eq, sql } from "drizzle-orm";

const logger = getLogger().child({ module: "router:onboarding" });

import { z } from "zod";
import { authenticatedProcedure, protectedProcedure } from "../server";
import { posthog } from "../server-instances";

const EARLY_ACCESS_FLAG_KEYS = [
   "contacts",
   "inventory",
   "services",
   "advanced-analytics",
   "data-management",
];

async function enrollInAllFeatures(userId: string, organizationId: string) {
   try {
      for (const flagKey of EARLY_ACCESS_FLAG_KEYS) {
         posthog.capture({
            distinctId: userId,
            event: "$feature_enrollment_update",
            properties: {
               $feature_flag: flagKey,
               $feature_enrollment: true,
               $set: { [`$feature_enrollment/${flagKey}`]: true },
            },
            groups: { organization: organizationId },
         });
      }
      logger.info(
         { userId, flagCount: EARLY_ACCESS_FLAG_KEYS.length },
         "Enrolled user in all early access features",
      );
   } catch (error) {
      logger.error({ err: error }, "Failed to enroll in early access features");
   }
}

async function runOnboardingCompletion(
   tx: DatabaseInstance,
   {
      organizationId,
      teamId,
      userId,
      workspaceName,
      slug,
      accountType,
   }: {
      organizationId: string;
      teamId: string;
      userId: string;
      workspaceName: string;
      slug: string;
      accountType: "personal" | "business";
   },
) {
   logger.info("Inserting teamMember");
   await tx.insert(teamMember).values({
      teamId,
      userId,
      createdAt: new Date(),
   });

   logger.info("Updating team");
   await tx
      .update(team)
      .set({
         slug,
         accountType,
         onboardingProducts: ["finance"],
         onboardingCompleted: true,
      })
      .where(eq(team.id, teamId));

   logger.info("Updating organization");
   await tx
      .update(organization)
      .set({ onboardingCompleted: true })
      .where(eq(organization.id, organizationId));

   logger.info("Creating default insights");
   const insightIds = await createDefaultInsights(
      tx,
      organizationId,
      teamId,
      userId,
   );
   logger.info({ count: insightIds.length }, "Insights created");

   for (const insightId of insightIds) {
      try {
         logger.info({ insightId }, "Computing insight");
         const insight = await getInsightById(tx, insightId);
         if (!insight) continue;
         const freshData = await computeInsightData(tx, insight);
         await tx
            .update(insights)
            .set({ cachedResults: freshData, lastComputedAt: new Date() })
            .where(eq(insights.id, insightId));
         logger.info({ insightId }, "Insight computed");
      } catch (error) {
         logger.error({ err: error, insightId }, "Failed to compute insight");
      }
   }

   logger.info("Creating dashboard");
   const tiles = insightIds.map((insightId, index) => ({
      insightId,
      size: DEFAULT_INSIGHTS[index].defaultSize,
      order: index,
   }));

   await tx.insert(dashboards).values({
      organizationId,
      teamId,
      createdBy: userId,
      name: `Dashboard ${workspaceName}`,
      description: null,
      isDefault: true,
      tiles,
   });
   logger.info("Onboarding completion done");
}

export const createWorkspace = authenticatedProcedure
   .input(
      z.object({
         workspaceName: z
            .string()
            .min(2, "O nome deve ter no mínimo 2 caracteres."),
         accountType: z.enum(["personal", "business"]).default("personal"),
      }),
   )
   .handler(async ({ context, input }) => {
      const { auth, headers, db, userId } = context;

      const slug = createSlug(input.workspaceName);

      logger.info(
         {
            userId,
            workspaceName: input.workspaceName,
            slug,
            accountType: input.accountType,
         },
         "Starting workspace creation",
      );

      const org = await auth.api.createOrganization({
         headers,
         body: { name: input.workspaceName, slug },
      });

      logger.info(
         { orgId: org?.id, orgSlug: org?.slug },
         "Organization created",
      );

      if (!org?.id) {
         throw new ORPCError("INTERNAL_SERVER_ERROR", {
            message: "Failed to create workspace",
         });
      }

      await auth.api.setActiveOrganization({
         headers,
         body: { organizationId: org.id },
      });

      logger.info({ orgId: org.id }, "Active organization set");

      const accountTypeLabel =
         input.accountType === "business" ? "Empresarial" : "Pessoal";
      const teamName = `${input.workspaceName} - ${accountTypeLabel}`;
      const teamSlug = createSlug(teamName);
      const createdTeam = await auth.api.createTeam({
         headers,
         body: {
            name: teamName,
            organizationId: org.id,
            slug: teamSlug,
            accountType: input.accountType,
         },
      });

      logger.info({ teamId: createdTeam?.id }, "Team created");

      if (!createdTeam?.id) {
         throw new ORPCError("INTERNAL_SERVER_ERROR", {
            message: "Failed to create team",
         });
      }

      logger.info("Starting transaction");
      await db.transaction(async (tx) => {
         await runOnboardingCompletion(tx, {
            organizationId: org.id,
            teamId: createdTeam.id,
            userId,
            workspaceName: teamName,
            slug,
            accountType: input.accountType,
         });
      });
      logger.info("Transaction committed");

      if (input.accountType === "business") {
         await enrollInAllFeatures(userId, org.id);
      }

      logger.info(
         {
            orgId: org.id,
            orgSlug: org.slug ?? slug,
            teamId: createdTeam.id,
            teamSlug: slug,
         },
         "Onboarding complete",
      );

      return {
         orgId: org.id,
         orgSlug: org.slug ?? slug,
         teamId: createdTeam.id,
         teamSlug: slug,
      };
   });

/**
 * Get the current onboarding status for both organization and project.
 * Used by the post-onboarding checklist on /home to auto-detect completed tasks.
 */
export const getOnboardingStatus = protectedProcedure.handler(
   async ({ context }) => {
      const { db, organizationId, teamId } = context;

      const org = await db.query.organization.findFirst({
         where: { id: organizationId },
      });

      if (!org) {
         throw new ORPCError("NOT_FOUND", {
            message: "Organization not found",
         });
      }

      const currentTeam = await db.query.team.findFirst({
         where: { id: teamId },
      });

      if (!currentTeam) {
         throw new ORPCError("NOT_FOUND", {
            message: "Team not found",
         });
      }

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

      const storedTasks = currentTeam.onboardingTasks ?? {};
      const autoDetected: Record<string, boolean> = {};

      if (bankAccountCount > 0) autoDetected.connect_bank_account = true;
      if (insightCount > 0) autoDetected.create_insight = true;
      if (categoryCount > 0) autoDetected.create_category = true;
      if (transactionCount > 0) autoDetected.add_transaction = true;

      const tasks = { ...storedTasks, ...autoDetected };

      return {
         organization: {
            onboardingCompleted: org.onboardingCompleted ?? false,
            name: org.name,
            slug: org.slug,
         },
         project: {
            onboardingCompleted: currentTeam.onboardingCompleted ?? false,
            onboardingProducts: currentTeam.onboardingProducts ?? null,
            tasks: Object.keys(tasks).length > 0 ? tasks : null,
            name: currentTeam.name,
            accountType:
               (currentTeam.accountType as "personal" | "business") ??
               "personal",
         },
      };
   },
);

/**
 * Safely mark org and team onboarding as complete for users who already have
 * an existing org/team but whose onboarding flags are still false.
 * Idempotent — only updates what isn't already marked complete.
 * Returns orgSlug and teamSlug for client-side navigation.
 */
export const fixOnboarding = authenticatedProcedure
   .input(z.object({ organizationId: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      const { db, session } = context;

      const orgId = input.organizationId;

      const org = await db.query.organization.findFirst({
         where: { id: orgId },
         columns: { id: true, slug: true, onboardingCompleted: true },
      });

      if (!org) {
         throw new ORPCError("NOT_FOUND", {
            message: "Organization not found",
         });
      }

      const activeTeamId = session.session.activeTeamId;

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

      if (!targetTeam) {
         throw new ORPCError("NOT_FOUND", {
            message: "No team found for organization",
         });
      }

      if (!org.onboardingCompleted || !targetTeam.onboardingCompleted) {
         await db.transaction(async (tx) => {
            if (!org.onboardingCompleted) {
               await tx
                  .update(organization)
                  .set({ onboardingCompleted: true })
                  .where(eq(organization.id, orgId));
            }
            // biome-ignore lint/style/noNonNullAssertion: checked above
            if (!targetTeam!.onboardingCompleted) {
               await tx
                  .update(team)
                  .set({ onboardingCompleted: true })
                  // biome-ignore lint/style/noNonNullAssertion: checked above
                  .where(eq(team.id, targetTeam!.id));
            }
         });
      }

      return { orgSlug: org.slug, teamSlug: targetTeam.slug };
   });

/**
 * Atomically merge a task ID into the team's onboardingTasks jsonb.
 */
async function markTaskDone(
   db: DatabaseInstance,
   teamId: string,
   taskId: string,
) {
   await db
      .update(team)
      .set({
         onboardingTasks: sql`COALESCE(${team.onboardingTasks}, '{}'::jsonb) || ${JSON.stringify({ [taskId]: true })}::jsonb`,
      })
      .where(eq(team.id, teamId));
}

/**
 * Mark a specific onboarding task as completed.
 */
export const completeTask = protectedProcedure
   .input(z.object({ taskId: z.string().min(1).max(100) }))
   .handler(async ({ context, input }) => {
      await markTaskDone(context.db, context.teamId, input.taskId);
      return { success: true };
   });

/**
 * Skip a specific onboarding task.
 */
export const skipTask = protectedProcedure
   .input(z.object({ taskId: z.string().min(1).max(100) }))
   .handler(async ({ context, input }) => {
      await markTaskDone(context.db, context.teamId, input.taskId);
      return { success: true };
   });

/**
 * Complete onboarding for an existing org/team.
 * Kept for backwards-compatibility — new workspaces use createWorkspace instead.
 */
export const completeOnboarding = protectedProcedure
   .input(z.object({ products: z.array(z.enum(["finance"])) }))
   .handler(async ({ context }) => {
      const { db, organizationId, teamId, userId } = context;

      const teamRecord = await db.query.team.findFirst({
         where: { id: teamId },
         columns: { name: true, slug: true },
      });

      await db.transaction(async (tx) => {
         await runOnboardingCompletion(tx, {
            organizationId,
            teamId,
            userId,
            workspaceName: teamRecord?.name ?? "Workspace",
            slug: teamRecord?.slug ?? teamId,
            accountType: "personal",
         });
      });

      const org = await db.query.organization.findFirst({
         where: { id: organizationId },
         columns: { slug: true },
      });

      return { slug: org?.slug ?? "", teamId };
   });
