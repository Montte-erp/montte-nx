import { ORPCError } from "@orpc/server";
import { computeInsightData } from "@packages/analytics/compute-insight";
import type { DatabaseInstance } from "@packages/database/client";
import { DEFAULT_INSIGHTS } from "@packages/database/default-insights";
import { createDefaultInsights } from "@packages/database/repositories/dashboard-repository";
import { getInsightById } from "@packages/database/repositories/insight-repository";
import { organization, team, teamMember } from "@packages/database/schemas/auth";
import { categories } from "@packages/database/schemas/categories";
import { dashboards } from "@packages/database/schemas/dashboards";
import { insights } from "@packages/database/schemas/insights";
import { transactions } from "@packages/database/schemas/transactions";
import { createSlug } from "@packages/utils/text";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { authenticatedProcedure, protectedProcedure } from "../server";


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
   console.log("[runOnboardingCompletion] Inserting teamMember");
   await tx.insert(teamMember).values({
      teamId,
      userId,
      createdAt: new Date(),
   });

   console.log("[runOnboardingCompletion] Updating team");
   await tx
      .update(team)
      .set({
         slug,
         accountType,
         onboardingProducts: ["finance"],
         onboardingCompleted: true,
      })
      .where(eq(team.id, teamId));

   console.log("[runOnboardingCompletion] Updating organization");
   await tx
      .update(organization)
      .set({ onboardingCompleted: true })
      .where(eq(organization.id, organizationId));

   console.log("[runOnboardingCompletion] Creating default insights");
   const insightIds = await createDefaultInsights(
      tx,
      organizationId,
      teamId,
      userId,
   );
   console.log("[runOnboardingCompletion] Insights created:", insightIds.length);

   for (const insightId of insightIds) {
      try {
         console.log("[runOnboardingCompletion] Computing insight:", insightId);
         const insight = await getInsightById(tx, insightId);
         if (!insight) continue;
         const freshData = await computeInsightData(tx, insight);
         await tx
            .update(insights)
            .set({ cachedResults: freshData, lastComputedAt: new Date() })
            .where(eq(insights.id, insightId));
         console.log("[runOnboardingCompletion] Insight computed:", insightId);
      } catch (error) {
         console.error(
            `[Onboarding] Failed to compute insight ${insightId}:`,
            error,
         );
      }
   }

   console.log("[runOnboardingCompletion] Creating dashboard");
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
   console.log("[runOnboardingCompletion] Done");
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

      console.log("[createWorkspace] Starting:", {
         userId,
         workspaceName: input.workspaceName,
         slug,
         accountType: input.accountType,
      });

      const org = await auth.api.createOrganization({
         headers,
         body: { name: input.workspaceName, slug },
      });

      console.log("[createWorkspace] Organization created:", {
         orgId: org?.id,
         orgSlug: org?.slug,
      });

      if (!org?.id) {
         throw new ORPCError("INTERNAL_SERVER_ERROR", {
            message: "Failed to create workspace",
         });
      }

      await auth.api.setActiveOrganization({
         headers,
         body: { organizationId: org.id },
      });

      console.log("[createWorkspace] Active organization set:", org.id);

      const accountTypeLabel =
         input.accountType === "business" ? "Empresarial" : "Pessoal";
      const teamName = `${input.workspaceName} - ${accountTypeLabel}`;

      const createdTeam = await auth.api.createTeam({
         headers,
         body: {
            name: teamName,
            organizationId: org.id,
            slug,
            accountType: input.accountType,
         },
      });

      console.log("[createWorkspace] Team created:", {
         teamId: createdTeam?.id,
      });

      if (!createdTeam?.id) {
         throw new ORPCError("INTERNAL_SERVER_ERROR", {
            message: "Failed to create team",
         });
      }

      console.log("[createWorkspace] Starting transaction");
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
      console.log("[createWorkspace] Transaction committed");

      console.log("[createWorkspace] Onboarding complete:", {
         orgId: org.id,
         orgSlug: org.slug ?? slug,
         teamId: createdTeam.id,
         teamSlug: slug,
      });

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
         where: (o, { eq }) => eq(o.id, organizationId),
      });

      if (!org) {
         throw new ORPCError("NOT_FOUND", {
            message: "Organization not found",
         });
      }

      const currentTeam = await db.query.team.findFirst({
         where: (t, { eq }) => eq(t.id, teamId),
      });

      if (!currentTeam) {
         throw new ORPCError("NOT_FOUND", {
            message: "Team not found",
         });
      }

      const [insightCount, categoryCount, transactionCount] = await Promise.all(
         [
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
         ],
      );

      const storedTasks = currentTeam.onboardingTasks ?? {};
      const autoDetected: Record<string, boolean> = {};

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
         where: (o, { eq }) => eq(o.id, orgId),
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
              where: (t, { eq }) => eq(t.id, activeTeamId),
              columns: { id: true, slug: true, onboardingCompleted: true },
           })
         : null;

      if (!targetTeam) {
         targetTeam = await db.query.team.findFirst({
            where: (t, { eq }) => eq(t.organizationId, orgId),
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
   },
);

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
         where: (t, { eq }) => eq(t.id, teamId),
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
         where: (o, { eq }) => eq(o.id, organizationId),
         columns: { slug: true },
      });

      return { slug: org?.slug ?? "", teamId };
   });
