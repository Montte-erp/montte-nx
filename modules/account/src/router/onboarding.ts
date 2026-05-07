import { eq, sql } from "drizzle-orm";
import { fromPromise } from "neverthrow";
import { z } from "zod";
import { cnpjDataSchema } from "@core/authentication/server";
import type { DatabaseInstance } from "@core/database/client";
import { organization, team } from "@core/database/schemas/auth";
import { bankAccounts } from "@core/database/schemas/bank-accounts";
import { categories } from "@core/database/schemas/categories";
import { contacts } from "@core/database/schemas/contacts";
import { insights } from "@core/database/schemas/insights";
import { services } from "@core/database/schemas/services";
import { transactions } from "@core/database/schemas/transactions";
import { WebAppError } from "@core/logging/errors";
import { authenticatedProcedure, protectedProcedure } from "@core/orpc/server";
import { createSlug } from "@core/utils/text";
import {
   enrollInAllFeatures,
   runOnboardingCompletion,
   type OnboardingProduct,
} from "@modules/account/onboarding-seed";

const onboardingGoalSchema = z.enum([
   "finance",
   "clients_services",
   "pick_myself",
]);

const productsByGoal: Record<
   z.infer<typeof onboardingGoalSchema>,
   OnboardingProduct[]
> = {
   finance: ["finance"],
   clients_services: ["contacts", "services"],
   pick_myself: [],
};

export const createWorkspace = authenticatedProcedure
   .input(
      z.object({
         workspaceName: z
            .string()
            .min(2, "O nome deve ter no mínimo 2 caracteres."),
         onboardingGoal: onboardingGoalSchema.default("pick_myself"),
         isMultiOrgCreation: z.boolean().default(false),
      }),
   )
   .handler(async ({ context, input }) => {
      const slug = createSlug(input.workspaceName);
      const onboardingProducts = productsByGoal[input.onboardingGoal];

      const org = await context.auth.api.createOrganization({
         headers: context.headers,
         body: { name: input.workspaceName, slug },
      });
      if (!org?.id) throw WebAppError.internal("Falha ao criar organização.");

      await context.auth.api.setActiveOrganization({
         headers: context.headers,
         body: { organizationId: org.id },
      });

      const teamName = "Principal";
      const teamSlug = createSlug(teamName);

      const created = await context.auth.api.createTeam({
         headers: context.headers,
         body: {
            name: teamName,
            organizationId: org.id,
            slug: teamSlug,
         },
      });
      if (!created?.id) throw WebAppError.internal("Falha ao criar projeto.");

      await runOnboardingCompletion({
         db: context.db,
         organizationId: org.id,
         teamId: created.id,
         userId: context.userId,
         slug: teamSlug,
         onboardingProducts,
      });

      if (context.posthog) {
         enrollInAllFeatures(context.posthog, context.userId, org.id);
         context.posthog.groupIdentify({
            groupType: "organization",
            groupKey: org.id,
            properties: {
               onboarding_goal: input.onboardingGoal,
               onboarding_version: "2026-05",
            },
         });
         context.posthog.capture({
            distinctId: context.userId,
            event: "workspace_created",
            properties: {
               onboarding_goal: input.onboardingGoal,
               onboarding_version: "2026-05",
               is_multi_org_creation: input.isMultiOrgCreation,
               organization_id: org.id,
               team_id: created.id,
            },
            groups: { organization: org.id },
         });
      }

      return {
         orgId: org.id,
         orgSlug: org.slug ?? slug,
         teamId: created.id,
         teamSlug,
      };
   });

export const getOnboardingStatus = protectedProcedure.handler(
   async ({ context }) => {
      const { db, organizationId, teamId } = context;

      const org = await db.query.organization.findFirst({
         where: (f, { eq }) => eq(f.id, organizationId),
      });
      if (!org) throw WebAppError.notFound("Organização não encontrada.");

      const currentTeam = await db.query.team.findFirst({
         where: (f, { eq }) => eq(f.id, teamId),
      });
      if (!currentTeam) throw WebAppError.notFound("Projeto não encontrado.");

      const [insightCount, categoryCount, transactionCount, bankAccountCount] =
         await Promise.all([
            db.$count(insights, eq(insights.organizationId, organizationId)),
            db.$count(categories, eq(categories.teamId, teamId)),
            db.$count(transactions, eq(transactions.teamId, teamId)),
            db.$count(bankAccounts, eq(bankAccounts.teamId, teamId)),
         ]);
      const [contactCount, serviceCount] = await Promise.all([
         db.$count(contacts, eq(contacts.teamId, teamId)),
         db.$count(services, eq(services.teamId, teamId)),
      ]);

      const stored = currentTeam.onboardingTasks ?? {};
      const auto: Record<string, boolean> = {};
      if (bankAccountCount > 0) auto.connect_bank_account = true;
      if (insightCount > 0) auto.create_insight = true;
      if (categoryCount > 0) auto.create_category = true;
      if (transactionCount > 0) auto.add_transaction = true;
      if (contactCount > 0) auto.create_contact = true;
      if (serviceCount > 0) auto.create_service = true;
      const tasks = { ...stored, ...auto };

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
            cnpjData: currentTeam.cnpjData
               ? cnpjDataSchema.parse(currentTeam.cnpjData)
               : null,
         },
      };
   },
);

export const fixOnboarding = authenticatedProcedure
   .input(z.object({ organizationId: z.uuid() }))
   .handler(async ({ context, input }) => {
      const { db, session } = context;

      const org = await db.query.organization.findFirst({
         where: (f, { eq }) => eq(f.id, input.organizationId),
         columns: { id: true, slug: true, onboardingCompleted: true },
      });
      if (!org) throw WebAppError.notFound("Organização não encontrada.");

      const activeTeamId = session.session.activeTeamId;
      const targetTeam = activeTeamId
         ? await db.query.team.findFirst({
              where: (f, { eq }) => eq(f.id, activeTeamId),
              columns: { id: true, slug: true, onboardingCompleted: true },
           })
         : await db.query.team.findFirst({
              where: (f, { eq }) => eq(f.organizationId, org.id),
              columns: { id: true, slug: true, onboardingCompleted: true },
           });
      if (!targetTeam)
         throw WebAppError.notFound("Nenhum projeto na organização.");

      const result = await fromPromise(
         db.transaction(async (tx) => {
            if (!org.onboardingCompleted)
               await tx
                  .update(organization)
                  .set({ onboardingCompleted: true })
                  .where(eq(organization.id, input.organizationId));

            if (!targetTeam.onboardingCompleted)
               await tx
                  .update(team)
                  .set({
                     slug: targetTeam.slug ?? "",
                     onboardingProducts: ["finance"],
                     onboardingCompleted: true,
                  })
                  .where(eq(team.id, targetTeam.id));
         }),
         () => WebAppError.internal("Falha ao corrigir onboarding."),
      );
      if (result.isErr()) throw result.error;

      return { orgSlug: org.slug, teamSlug: targetTeam.slug };
   });

const taskInput = z.object({ taskId: z.string().min(1).max(100) });

async function markTaskDone(
   db: DatabaseInstance,
   teamId: string,
   taskId: string,
) {
   await db.transaction(async (tx) => {
      await tx
         .update(team)
         .set({
            onboardingTasks: sql`COALESCE(${team.onboardingTasks}, '{}'::jsonb) || ${JSON.stringify({ [taskId]: true })}::jsonb`,
         })
         .where(eq(team.id, teamId));
   });
}

export const completeTask = protectedProcedure
   .input(taskInput)
   .handler(async ({ context, input }) => {
      await markTaskDone(context.db, context.teamId, input.taskId);
      return { success: true };
   });

export const skipTask = protectedProcedure
   .input(taskInput)
   .handler(async ({ context, input }) => {
      await markTaskDone(context.db, context.teamId, input.taskId);
      return { success: true };
   });

export const completeOnboarding = protectedProcedure
   .input(
      z.object({
         products: z.array(z.enum(["finance", "contacts", "services"])),
      }),
   )
   .handler(async ({ context, input }) => {
      const { db, organizationId, teamId, userId } = context;

      const teamRecord = await db.query.team.findFirst({
         where: (f, { eq }) => eq(f.id, teamId),
         columns: { slug: true },
      });

      await runOnboardingCompletion({
         db,
         organizationId,
         teamId,
         userId,
         slug: teamRecord?.slug ?? teamId,
         onboardingProducts: input.products,
      });

      const org = await db.query.organization.findFirst({
         where: (f, { eq }) => eq(f.id, organizationId),
         columns: { slug: true },
      });

      return { slug: org?.slug ?? "", teamId };
   });
