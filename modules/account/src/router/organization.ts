import { Result } from "better-result";
import { z } from "zod";
import {
   AccountError,
   accountErrors,
   toAuthError,
} from "@modules/account/router/errors";
import { authenticatedProcedure, protectedProcedure } from "@core/orpc/server";
import { createSlug } from "@core/utils/text";
import { requireOrganizationTeam } from "@modules/account/router/middlewares";

export const getOrganizations = authenticatedProcedure.handler(
   async ({ context }) => {
      const rowsResult = await Result.tryPromise({
         try: () =>
            context.db.query.member.findMany({
               where: (f, { eq }) => eq(f.userId, context.userId),
               with: { organization: true },
            }),
         catch: () =>
            new AccountError({
               error: accountErrors.INTERNAL(),
               message: "Falha ao listar organizações.",
               userId: context.userId,
            }),
      });
      if (rowsResult.isErr()) throw rowsResult.error;

      return rowsResult.value.map((m) => ({
         id: m.organization.id,
         name: m.organization.name,
         slug: m.organization.slug,
         logo: m.organization.logo,
         role: m.role,
         onboardingCompleted: m.organization.onboardingCompleted,
      }));
   },
);

export const getActiveOrganization = protectedProcedure.handler(
   async ({ context }) => {
      const orgId = context.session.session.activeOrganizationId;
      if (!orgId) return null;

      const result = await Result.tryPromise({
         try: () =>
            context.auth.api.getFullOrganization({
               headers: context.headers,
               query: { organizationId: orgId },
            }),
         catch: (error) =>
            toAuthError(
               error,
               "Autenticação necessária.",
               "Permissões insuficientes.",
               "Falha ao recuperar dados da organização.",
            ),
      });
      if (result.isErr()) throw result.error;

      return result.value
         ? { ...result.value, activeSubscription: null }
         : null;
   },
);

export const getOrganizationTeams = protectedProcedure
   .input(z.object({ orgSlug: z.string().optional() }).optional())
   .handler(async ({ context, input }) => {
      let organizationId = context.organizationId;
      if (input?.orgSlug) {
         const rowsResult = await Result.tryPromise({
            try: () =>
               context.db.query.member.findMany({
                  where: (f, { eq }) => eq(f.userId, context.userId),
                  with: { organization: true },
               }),
            catch: () =>
               new AccountError({
                  error: accountErrors.INTERNAL(),
                  message: "Falha ao localizar organização selecionada.",
                  userId: context.userId,
               }),
         });
         if (rowsResult.isErr()) throw rowsResult.error;

         const scopedOrg = rowsResult.value.find(
            (m) => m.organization.slug === input.orgSlug,
         );
         if (!scopedOrg) {
            throw new AccountError({
               error: accountErrors.NOT_FOUND(),
               message: "Organização não encontrada.",
               userId: context.userId,
            });
         }
         organizationId = scopedOrg.organization.id;
      }

      const result = await Result.tryPromise({
         try: () =>
            context.auth.api.listOrganizationTeams({
               headers: context.headers,
               query: { organizationId },
            }),
         catch: (error) =>
            toAuthError(
               error,
               "Autenticação necessária.",
               "Permissões insuficientes.",
               "Falha ao listar projetos da organização.",
            ),
      });
      if (result.isErr()) throw result.error;
      return result.value;
   });

export const createTeam = protectedProcedure
   .input(
      z.object({
         name: z
            .string()
            .min(1, "Nome do espaço é obrigatório")
            .max(50, "O nome deve ter menos de 50 caracteres"),
      }),
   )
   .handler(async ({ context, input }) => {
      const slug = createSlug(input.name);
      const result = await Result.tryPromise({
         try: () =>
            context.auth.api.createTeam({
               headers: context.headers,
               body: {
                  name: input.name,
                  organizationId: context.organizationId,
                  slug,
               },
            }),
         catch: (error) =>
            toAuthError(
               error,
               "Autenticação necessária.",
               "Permissões insuficientes.",
               "Falha ao criar espaço.",
            ),
      });
      if (result.isErr()) throw result.error;

      const team = result.value;
      if (!team?.id) {
         throw new AccountError({
            error: accountErrors.INTERNAL(),
            message: "Falha ao criar espaço.",
         });
      }

      return { id: team.id, name: team.name, slug: team.slug ?? slug };
   });

export const getMembers = protectedProcedure.handler(async ({ context }) => {
   const result = await Result.tryPromise({
      try: () =>
         context.auth.api.listMembers({
            headers: context.headers,
            query: { organizationId: context.organizationId },
         }),
      catch: (error) =>
         toAuthError(
            error,
            "Autenticação necessária.",
            "Permissões insuficientes.",
            "Falha ao listar membros.",
         ),
   });
   if (result.isErr()) throw result.error;

   return result.value.members.map((m) => ({
      id: m.id,
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      image: m.user.image ?? null,
      createdAt: m.createdAt,
   }));
});

export const getPendingInvitations = protectedProcedure.handler(
   async ({ context }) => {
      const result = await Result.tryPromise({
         try: () =>
            context.auth.api.listInvitations({
               headers: context.headers,
               query: { organizationId: context.organizationId },
            }),
         catch: (error) =>
            toAuthError(
               error,
               "Autenticação necessária.",
               "Permissões insuficientes.",
               "Falha ao listar convites.",
            ),
      });
      if (result.isErr()) throw result.error;
      return result.value
         .filter((inv) => inv.status === "pending")
         .map((inv) => ({
            id: inv.id,
            email: inv.email,
            role: inv.role ?? "member",
            teamId: inv.teamId ?? null,
            status: inv.status,
            expiresAt: inv.expiresAt,
            createdAt: inv.createdAt,
         }))
         .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
   },
);

export const getTeamMembers = protectedProcedure
   .input(z.object({ teamId: z.string() }))
   .use(requireOrganizationTeam, (input) => input.teamId)
   .handler(async ({ context, input }) => {
      const result = await Result.tryPromise({
         try: () =>
            context.auth.api.listTeamMembers({
               headers: context.headers,
               query: { teamId: input.teamId },
            }),
         catch: (error) =>
            toAuthError(
               error,
               "Autenticação necessária.",
               "Permissões insuficientes.",
               "Falha ao listar membros do espaço.",
            ),
      });
      if (result.isErr()) throw result.error;

      const rows = result.value;
      if (rows.length === 0) return [];

      const userIds = rows.map((r) => r.userId);
      const usersResult = await Result.tryPromise({
         try: () =>
            context.db.query.user.findMany({
               where: (f, { inArray }) => inArray(f.id, userIds),
               columns: { id: true, name: true, email: true, image: true },
            }),
         catch: () =>
            new AccountError({
               error: accountErrors.INTERNAL(),
               message: "Falha ao carregar usuários do projeto.",
            }),
      });
      if (usersResult.isErr()) throw usersResult.error;

      const byId = new Map(usersResult.value.map((u) => [u.id, u]));
      return rows.map((r) => {
         const u = byId.get(r.userId);
         return {
            id: r.id,
            userId: r.userId,
            teamId: r.teamId,
            name: u?.name ?? "",
            email: u?.email ?? "",
            image: u?.image ?? null,
            createdAt: r.createdAt,
         };
      });
   });

export const getMemberTeams = protectedProcedure
   .input(z.object({ userId: z.uuid() }))
   .handler(async ({ context, input }) => {
      const teamsResult = await Result.tryPromise({
         try: () =>
            context.db.query.team.findMany({
               where: (f, { eq }) =>
                  eq(f.organizationId, context.organizationId),
            }),
         catch: () =>
            new AccountError({
               error: accountErrors.INTERNAL(),
               message: "Falha ao carregar projetos da organização.",
               organizationId: context.organizationId,
            }),
      });
      if (teamsResult.isErr()) throw teamsResult.error;

      const membershipsResult = await Result.tryPromise({
         try: () =>
            context.db.query.teamMember.findMany({
               where: (f, { eq }) => eq(f.userId, input.userId),
            }),
         catch: () =>
            new AccountError({
               error: accountErrors.INTERNAL(),
               message: "Falha ao carregar membros do projeto.",
               organizationId: context.organizationId,
            }),
      });
      if (membershipsResult.isErr()) throw membershipsResult.error;

      const ids = new Set(membershipsResult.value.map((tm) => tm.teamId));
      return teamsResult.value
         .filter((t) => ids.has(t.id))
         .map((t) => ({ id: t.id, name: t.name }));
   });
