import { fromPromise } from "neverthrow";
import { z } from "zod";
import { WebAppError } from "@core/logging/errors";
import { authenticatedProcedure, protectedProcedure } from "@core/orpc/server";
import { createSlug } from "@core/utils/text";
import { requireOrganizationTeam } from "@modules/account/router/middlewares";

const authError = (fallback: string) => (e: unknown) => {
   if (e && typeof e === "object") {
      const status =
         "status" in e ? (e as { status: unknown }).status : undefined;
      const code =
         "statusCode" in e
            ? (e as { statusCode: unknown }).statusCode
            : undefined;
      if (status === "UNAUTHORIZED" || code === 401)
         return WebAppError.unauthorized("Autenticação necessária.");
      if (status === "FORBIDDEN" || code === 403)
         return WebAppError.forbidden("Permissões insuficientes.");
   }
   return WebAppError.internal(fallback);
};

export const getOrganizations = authenticatedProcedure.handler(
   async ({ context }) => {
      const rows = await context.db.query.member.findMany({
         where: (f, { eq }) => eq(f.userId, context.userId),
         with: { organization: true },
      });
      return rows.map((m) => ({
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

      const result = await fromPromise(
         context.auth.api.getFullOrganization({
            headers: context.headers,
            query: { organizationId: orgId },
         }),
         authError("Falha ao recuperar dados da organização."),
      ).map((org) => (org ? { ...org, activeSubscription: null } : null));
      if (result.isErr()) throw result.error;
      return result.value;
   },
);

export const getOrganizationTeams = protectedProcedure
   .input(z.object({ orgSlug: z.string().optional() }).optional())
   .handler(async ({ context, input }) => {
      let organizationId = context.organizationId;
      if (input?.orgSlug) {
         const rows = await context.db.query.member.findMany({
            where: (f, { eq }) => eq(f.userId, context.userId),
            with: { organization: true },
         });
         const scopedOrg = rows.find(
            (m) => m.organization.slug === input.orgSlug,
         );
         if (!scopedOrg) {
            throw WebAppError.notFound("Organização não encontrada.");
         }
         organizationId = scopedOrg.organization.id;
      }

      const result = await fromPromise(
         context.auth.api.listOrganizationTeams({
            headers: context.headers,
            query: { organizationId },
         }),
         authError("Falha ao listar projetos da organização."),
      );
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
      const result = await fromPromise(
         context.auth.api.createTeam({
            headers: context.headers,
            body: {
               name: input.name,
               organizationId: context.organizationId,
               slug,
            },
         }),
         authError("Falha ao criar espaço."),
      );
      if (result.isErr()) throw result.error;
      const team = result.value;
      if (!team?.id) throw WebAppError.internal("Falha ao criar espaço.");
      return { id: team.id, name: team.name, slug: team.slug ?? slug };
   });

export const getMembers = protectedProcedure.handler(async ({ context }) => {
   const result = await fromPromise(
      context.auth.api.listMembers({
         headers: context.headers,
         query: { organizationId: context.organizationId },
      }),
      authError("Falha ao listar membros."),
   );
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
      const result = await fromPromise(
         context.auth.api.listInvitations({
            headers: context.headers,
            query: { organizationId: context.organizationId },
         }),
         authError("Falha ao listar convites."),
      );
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
      const result = await fromPromise(
         context.auth.api.listTeamMembers({
            headers: context.headers,
            query: { teamId: input.teamId },
         }),
         authError("Falha ao listar membros do espaço."),
      );
      if (result.isErr()) throw result.error;
      const rows = result.value;
      if (rows.length === 0) return [];
      const userIds = rows.map((r) => r.userId);
      const users = await context.db.query.user.findMany({
         where: (f, { inArray }) => inArray(f.id, userIds),
         columns: { id: true, name: true, email: true, image: true },
      });
      const byId = new Map(users.map((u) => [u.id, u]));
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
      const teams = await context.db.query.team.findMany({
         where: (f, { eq }) => eq(f.organizationId, context.organizationId),
      });
      const memberships = await context.db.query.teamMember.findMany({
         where: (f, { eq }) => eq(f.userId, input.userId),
      });
      const ids = new Set(memberships.map((tm) => tm.teamId));
      return teams
         .filter((t) => ids.has(t.id))
         .map((t) => ({ id: t.id, name: t.name }));
   });
