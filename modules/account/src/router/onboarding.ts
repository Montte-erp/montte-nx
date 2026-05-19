import { eq, sql } from "drizzle-orm";
import { Result } from "better-result";
import { z } from "zod";
import { cnpjDataSchema } from "@core/authentication/server";
import type { DatabaseInstance } from "@core/database/client";
import { organization, team } from "@core/database/schemas/auth";
import { bankAccounts } from "@core/database/schemas/bank-accounts";
import { categories } from "@core/database/schemas/categories";
import { transactions } from "@core/database/schemas/transactions";
import { authenticatedProcedure, protectedProcedure } from "@core/orpc/server";
import { createSlug } from "@core/utils/text";
import {
   AccountError,
   accountErrors,
   toAuthError,
} from "@modules/account/router/errors";
import {
   enrollInAllFeatures,
   runOnboardingCompletion,
   type OnboardingProduct,
} from "@modules/account/onboarding-seed";

const onboardingFeatureSchema = z.enum(["finance"]);

export const createWorkspace = authenticatedProcedure
   .input(
      z.object({
         workspaceName: z
            .string()
            .min(2, "O nome deve ter no mínimo 2 caracteres."),
         features: z
            .array(onboardingFeatureSchema)
            .min(1, "Selecione pelo menos um produto."),
         isMultiOrgCreation: z.boolean().default(false),
      }),
   )
   .handler(async ({ context, input }) => {
      const slug = createSlug(input.workspaceName);
      const onboardingProducts: OnboardingProduct[] = Array.from(
         new Set(input.features),
      );

      const orgResult = await Result.tryPromise({
         try: () =>
            context.auth.api.createOrganization({
               headers: context.headers,
               body: { name: input.workspaceName, slug },
            }),
         catch: (error) =>
            toAuthError(
               error,
               "Falha ao criar organização.",
               "Permissões insuficientes.",
               "Falha ao criar organização.",
            ),
      });
      if (orgResult.isErr()) throw orgResult.error;
      if (!orgResult.value?.id) {
         throw new AccountError({
            error: accountErrors.INTERNAL(),
            message: "Falha ao criar organização.",
         });
      }

      const org = orgResult.value;

      const setActiveResult = await Result.tryPromise({
         try: () =>
            context.auth.api.setActiveOrganization({
               headers: context.headers,
               body: { organizationId: org.id },
            }),
         catch: (error) =>
            toAuthError(
               error,
               "Falha ao definir organização ativa.",
               "Permissões insuficientes.",
               "Falha ao definir organização ativa.",
            ),
      });
      if (setActiveResult.isErr()) throw setActiveResult.error;

      const teamName = "Principal";
      const teamSlug = createSlug(teamName);

      const createdResult = await Result.tryPromise({
         try: () =>
            context.auth.api.createTeam({
               headers: context.headers,
               body: {
                  name: teamName,
                  organizationId: org.id,
                  slug: teamSlug,
               },
            }),
         catch: (error) =>
            toAuthError(
               error,
               "Falha ao criar projeto.",
               "Permissões insuficientes.",
               "Falha ao criar projeto.",
            ),
      });
      if (createdResult.isErr()) throw createdResult.error;
      if (!createdResult.value?.id) {
         throw new AccountError({
            error: accountErrors.INTERNAL(),
            message: "Falha ao criar projeto.",
         });
      }

      await runOnboardingCompletion({
         db: context.db,
         organizationId: org.id,
         teamId: createdResult.value.id,
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
               onboarding_features: onboardingProducts,
               onboarding_version: "2026-05",
            },
         });
         context.posthog.capture({
            distinctId: context.userId,
            event: "workspace_created",
            properties: {
               onboarding_features: onboardingProducts,
               onboarding_version: "2026-05",
               is_multi_org_creation: input.isMultiOrgCreation,
               organization_id: org.id,
               team_id: createdResult.value.id,
            },
            groups: { organization: org.id },
         });
      }

      return {
         orgId: org.id,
         orgSlug: org.slug ?? slug,
         teamId: createdResult.value.id,
         teamSlug,
      };
   });

export const getOnboardingStatus = protectedProcedure.handler(
   async ({ context }) => {
      const { db, organizationId, teamId } = context;

      const orgResult = await Result.tryPromise({
         try: () =>
            db.query.organization.findFirst({
               where: (f, { eq }) => eq(f.id, organizationId),
            }),
         catch: () =>
            new AccountError({
               error: accountErrors.INTERNAL(),
               message: "Falha ao carregar organização.",
               organizationId,
            }),
      });
      if (orgResult.isErr()) throw orgResult.error;
      if (!orgResult.value) {
         throw new AccountError({
            error: accountErrors.NOT_FOUND(),
            message: "Organização não encontrada.",
            organizationId,
         });
      }

      const teamResult = await Result.tryPromise({
         try: () =>
            db.query.team.findFirst({
               where: (f, { eq }) => eq(f.id, teamId),
            }),
         catch: () =>
            new AccountError({
               error: accountErrors.INTERNAL(),
               message: "Falha ao carregar projeto.",
               organizationId,
               teamId,
            }),
      });
      if (teamResult.isErr()) throw teamResult.error;
      if (!teamResult.value) {
         throw new AccountError({
            error: accountErrors.NOT_FOUND(),
            message: "Projeto não encontrado.",
            organizationId,
            teamId,
         });
      }

      const countResult = await Result.tryPromise({
         try: () =>
            Promise.all([
               db.$count(categories, eq(categories.teamId, teamId)),
               db.$count(transactions, eq(transactions.teamId, teamId)),
               db.$count(bankAccounts, eq(bankAccounts.teamId, teamId)),
            ]),
         catch: () =>
            new AccountError({
               error: accountErrors.INTERNAL(),
               message: "Falha ao calcular progresso do onboarding.",
               organizationId,
               teamId,
            }),
      });
      if (countResult.isErr()) throw countResult.error;

      const [categoryCount, transactionCount, bankAccountCount] =
         countResult.value;

      const team = teamResult.value;
      const stored = team.onboardingTasks ?? {};
      const auto: Record<string, boolean> = {};
      if (bankAccountCount > 0) auto.connect_bank_account = true;
      if (categoryCount > 0) auto.create_category = true;
      if (transactionCount > 0) auto.add_transaction = true;
      const tasks = { ...stored, ...auto };

      const parsedCnpjDataResult = await Result.try({
         try: () =>
            team.cnpjData ? cnpjDataSchema.parse(team.cnpjData) : null,
         catch: () =>
            new AccountError({
               error: accountErrors.INTERNAL(),
               message: "Falha ao processar dados do projeto.",
               organizationId,
               teamId,
            }),
      });
      if (parsedCnpjDataResult.isErr()) throw parsedCnpjDataResult.error;

      return {
         organization: {
            onboardingCompleted: orgResult.value.onboardingCompleted ?? false,
            name: orgResult.value.name,
            slug: orgResult.value.slug,
         },
         project: {
            onboardingCompleted: team.onboardingCompleted ?? false,
            onboardingProducts: team.onboardingProducts ?? null,
            tasks: Object.keys(tasks).length > 0 ? tasks : null,
            name: team.name,
            cnpjData: parsedCnpjDataResult.value,
         },
      };
   },
);

export const fixOnboarding = authenticatedProcedure
   .input(z.object({ organizationId: z.uuid() }))
   .handler(async ({ context, input }) => {
      const { db, session } = context;

      const orgResult = await Result.tryPromise({
         try: () =>
            db.query.organization.findFirst({
               where: (f, { eq }) => eq(f.id, input.organizationId),
               columns: { id: true, slug: true, onboardingCompleted: true },
            }),
         catch: () =>
            new AccountError({
               error: accountErrors.INTERNAL(),
               message: "Falha ao carregar organização.",
               organizationId: input.organizationId,
            }),
      });
      if (orgResult.isErr()) throw orgResult.error;
      if (!orgResult.value) {
         throw new AccountError({
            error: accountErrors.NOT_FOUND(),
            message: "Organização não encontrada.",
            organizationId: input.organizationId,
         });
      }

      const activeTeamId = session.session.activeTeamId;
      const targetTeamResult = await (activeTeamId
         ? Result.tryPromise({
              try: () =>
                 db.query.team.findFirst({
                    where: (f, { eq }) => eq(f.id, activeTeamId),
                    columns: {
                       id: true,
                       slug: true,
                       onboardingCompleted: true,
                    },
                 }),
              catch: () =>
                 new AccountError({
                    error: accountErrors.INTERNAL(),
                    message: "Falha ao carregar projeto ativo.",
                    organizationId: input.organizationId,
                    teamId: activeTeamId,
                 }),
           })
         : Result.tryPromise({
              try: () =>
                 db.query.team.findFirst({
                    where: (f, { eq }) =>
                       eq(f.organizationId, input.organizationId),
                    columns: {
                       id: true,
                       slug: true,
                       onboardingCompleted: true,
                    },
                 }),
              catch: () =>
                 new AccountError({
                    error: accountErrors.INTERNAL(),
                    message: "Falha ao carregar projeto padrão.",
                    organizationId: input.organizationId,
                 }),
           }));
      if (targetTeamResult.isErr()) throw targetTeamResult.error;
      const targetTeam = targetTeamResult.value;
      if (!targetTeam) {
         throw new AccountError({
            error: accountErrors.NOT_FOUND(),
            message: "Nenhum projeto na organização.",
            organizationId: input.organizationId,
         });
      }

      const transaction = await Result.tryPromise({
         try: () =>
            db.transaction(async (tx) => {
               if (!orgResult.value?.onboardingCompleted) {
                  await tx
                     .update(organization)
                     .set({ onboardingCompleted: true })
                     .where(eq(organization.id, input.organizationId));
               }

               if (!targetTeam.onboardingCompleted) {
                  await tx
                     .update(team)
                     .set({
                        slug: targetTeam.slug ?? "",
                        onboardingProducts: ["finance"],
                        onboardingCompleted: true,
                     })
                     .where(eq(team.id, targetTeam.id));
               }
            }),
         catch: () =>
            new AccountError({
               error: accountErrors.INTERNAL(),
               message: "Falha ao corrigir onboarding.",
               organizationId: input.organizationId,
               teamId: targetTeam.id,
            }),
      });
      if (transaction.isErr()) throw transaction.error;

      return { orgSlug: orgResult.value.slug, teamSlug: targetTeam.slug };
   });

const taskInput = z.object({ taskId: z.string().min(1).max(100) });

async function markTaskDone(
   db: DatabaseInstance,
   teamId: string,
   taskId: string,
) {
   const result = await Result.tryPromise({
      try: () =>
         db.transaction(async (tx) => {
            await tx
               .update(team)
               .set({
                  onboardingTasks: sql`COALESCE(${team.onboardingTasks}, '{}'::jsonb) || ${JSON.stringify(
                     {
                        [taskId]: true,
                     },
                  )}::jsonb`,
               })
               .where(eq(team.id, teamId));
         }),
      catch: () =>
         new AccountError({
            error: accountErrors.INTERNAL(),
            message: "Falha ao concluir tarefa de onboarding.",
            teamId,
         }),
   });

   if (result.isErr()) throw result.error;
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
         products: z
            .array(onboardingFeatureSchema)
            .min(1, "Selecione pelo menos um produto."),
      }),
   )
   .handler(async ({ context, input }) => {
      const { db, organizationId, teamId, userId } = context;

      const teamRecordResult = await Result.tryPromise({
         try: () =>
            db.query.team.findFirst({
               where: (f, { eq }) => eq(f.id, teamId),
               columns: { slug: true },
            }),
         catch: () =>
            new AccountError({
               error: accountErrors.INTERNAL(),
               message: "Falha ao carregar projeto.",
               organizationId,
               teamId,
            }),
      });
      if (teamRecordResult.isErr()) throw teamRecordResult.error;

      await runOnboardingCompletion({
         db,
         organizationId,
         teamId,
         userId,
         slug: teamRecordResult.value?.slug ?? teamId,
         onboardingProducts: input.products,
      });

      const orgResult = await Result.tryPromise({
         try: () =>
            db.query.organization.findFirst({
               where: (f, { eq }) => eq(f.id, organizationId),
               columns: { slug: true },
            }),
         catch: () =>
            new AccountError({
               error: accountErrors.INTERNAL(),
               message: "Falha ao carregar organização.",
               organizationId,
            }),
      });
      if (orgResult.isErr()) throw orgResult.error;

      return { slug: orgResult.value?.slug ?? "", teamId };
   });
