import { ORPCError } from "@orpc/server";
import { computeInsightData } from "@packages/analytics/compute-insight";
import {
   createDefaultDashboard,
   createDefaultInsights,
} from "@packages/analytics/seed-defaults";
import { getInsightById } from "@core/database/repositories/insight-repository";
import {
   getOnboardingCounts,
   getOrgAndTeamOnboardingFlags,
   getOrganizationById,
   getOrganizationSlug,
   getTeamById,
   getTeamNameAndSlug,
   insertTeamMember,
   markOrganizationOnboardingComplete,
   markTaskDone,
   markTeamOnboardingComplete,
   updateInsightCache,
} from "@core/database/repositories/onboarding-repository";
import { getLogger } from "@core/logging/root";
import { createSlug } from "@core/utils/text";

const logger = getLogger().child({ module: "router:onboarding" });

import { z } from "zod";
import { authenticatedProcedure, protectedProcedure } from "../server";
import { posthog } from "@core/posthog/server";

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

async function runOnboardingCompletion({
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
}) {
   logger.info("Inserting teamMember");
   await insertTeamMember(teamId, userId);

   logger.info("Updating team");
   await markTeamOnboardingComplete(teamId, {
      slug,
      accountType,
      onboardingProducts: ["finance"],
   });

   logger.info("Updating organization");
   await markOrganizationOnboardingComplete(organizationId);

   logger.info("Creating default insights");
   const insightIds = await createDefaultInsights(
      organizationId,
      teamId,
      userId,
   );
   logger.info({ count: insightIds.length }, "Insights created");

   for (const insightId of insightIds) {
      try {
         logger.info({ insightId }, "Computing insight");
         const insight = await getInsightById(insightId);
         if (!insight) continue;
         const freshData = await computeInsightData(insight);
         await updateInsightCache(insightId, freshData);
         logger.info({ insightId }, "Insight computed");
      } catch (error) {
         logger.error({ err: error, insightId }, "Failed to compute insight");
      }
   }

   logger.info("Creating dashboard");
   await createDefaultDashboard(
      organizationId,
      teamId,
      userId,
      `Dashboard ${workspaceName}`,
      insightIds,
   );
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
      const { auth, headers, userId } = context;

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

      if (!org?.id) {
         throw new ORPCError("INTERNAL_SERVER_ERROR", {
            message: "Failed to create workspace",
         });
      }

      logger.info({ orgId: org.id, orgSlug: org.slug }, "Organization created");

      await auth.api.setActiveOrganization({
         headers,
         body: { organizationId: org.id },
      });

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

      if (!createdTeam?.id) {
         throw new ORPCError("INTERNAL_SERVER_ERROR", {
            message: "Failed to create team",
         });
      }

      logger.info({ teamId: createdTeam.id }, "Team created");

      await runOnboardingCompletion({
         organizationId: org.id,
         teamId: createdTeam.id,
         userId,
         workspaceName: teamName,
         slug,
         accountType: input.accountType,
      });

      if (input.accountType === "business") {
         try {
            await enrollInAllFeatures(userId, org.id);
         } catch (enrollError) {
            logger.error(
               { err: enrollError, step: "enrollInAllFeatures" },
               "Enrollment failed",
            );
            throw enrollError;
         }
      }

      logger.info(
         {
            orgId: org.id,
            orgSlug: org.slug ?? slug,
            teamId: createdTeam.id,
            teamSlug,
         },
         "Onboarding complete",
      );

      return {
         orgId: org.id,
         orgSlug: org.slug ?? slug,
         teamId: createdTeam.id,
         teamSlug,
      };
   });

export const getOnboardingStatus = protectedProcedure.handler(
   async ({ context }) => {
      const { organizationId, teamId } = context;

      const org = await getOrganizationById(organizationId);

      if (!org) {
         throw new ORPCError("NOT_FOUND", {
            message: "Organization not found",
         });
      }

      const currentTeam = await getTeamById(teamId);

      if (!currentTeam) {
         throw new ORPCError("NOT_FOUND", {
            message: "Team not found",
         });
      }

      const {
         insightCount,
         categoryCount,
         transactionCount,
         bankAccountCount,
      } = await getOnboardingCounts(organizationId, teamId);

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

export const fixOnboarding = authenticatedProcedure
   .input(z.object({ organizationId: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      const { session } = context;

      const { org, targetTeam } = await getOrgAndTeamOnboardingFlags(
         input.organizationId,
         session.session.activeTeamId,
      );

      if (!org) {
         throw new ORPCError("NOT_FOUND", {
            message: "Organization not found",
         });
      }

      if (!targetTeam) {
         throw new ORPCError("NOT_FOUND", {
            message: "No team found for organization",
         });
      }

      if (!org.onboardingCompleted) {
         await markOrganizationOnboardingComplete(input.organizationId);
      }

      if (!targetTeam.onboardingCompleted) {
         await markTeamOnboardingComplete(targetTeam.id, {
            slug: targetTeam.slug ?? "",
            accountType: "personal",
            onboardingProducts: ["finance"],
         });
      }

      return { orgSlug: org.slug, teamSlug: targetTeam.slug };
   });

export const completeTask = protectedProcedure
   .input(z.object({ taskId: z.string().min(1).max(100) }))
   .handler(async ({ context, input }) => {
      await markTaskDone(context.teamId, input.taskId);
      return { success: true };
   });

export const skipTask = protectedProcedure
   .input(z.object({ taskId: z.string().min(1).max(100) }))
   .handler(async ({ context, input }) => {
      await markTaskDone(context.teamId, input.taskId);
      return { success: true };
   });

export const completeOnboarding = protectedProcedure
   .input(z.object({ products: z.array(z.enum(["finance"])) }))
   .handler(async ({ context }) => {
      const { organizationId, teamId, userId } = context;

      const teamRecord = await getTeamNameAndSlug(teamId);

      await runOnboardingCompletion({
         organizationId,
         teamId,
         userId,
         workspaceName: teamRecord?.name ?? "Workspace",
         slug: teamRecord?.slug ?? teamId,
         accountType: "personal",
      });

      const org = await getOrganizationSlug(organizationId);

      return { slug: org?.slug ?? "", teamId };
   });
