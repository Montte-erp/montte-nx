import { eq } from "drizzle-orm";
import { fromPromise } from "neverthrow";
import { z } from "zod";
import { member, organization } from "@core/database/schemas/auth";
import { generatePresignedPutUrl } from "@core/files/client";
import { WebAppError } from "@core/logging/errors";
import { authenticatedProcedure, protectedProcedure } from "@core/orpc/server";

const isStatus = (e: unknown, status: string, code: number) =>
   !!e &&
   typeof e === "object" &&
   "status" in e &&
   ((e as { status?: unknown }).status === status ||
      (e as { statusCode?: unknown }).statusCode === code);

export const getOrganizations = authenticatedProcedure.handler(
   async ({ context }) =>
      context.db
         .select({
            id: organization.id,
            name: organization.name,
            slug: organization.slug,
            logo: organization.logo,
            role: member.role,
            onboardingCompleted: organization.onboardingCompleted,
         })
         .from(member)
         .innerJoin(organization, eq(member.organizationId, organization.id))
         .where(eq(member.userId, context.userId)),
);

export const getActiveOrganization = protectedProcedure.handler(
   async ({ context }) => {
      const orgId = context.session.session.activeOrganizationId;
      if (!orgId) return null;

      const result = await fromPromise(
         (async () => {
            const org = await context.auth.api.getFullOrganization({
               headers: context.headers,
               query: { organizationId: orgId },
            });
            if (!org) return null;
            const teams = await context.auth.api.listOrganizationTeams({
               headers: context.headers,
               query: { organizationId: org.id },
            });
            return {
               ...org,
               activeSubscription: null,
               projectLimit: 1,
               projectCount: teams.length,
            };
         })(),
         (e) => e,
      );
      if (result.isErr()) {
         const e = result.error;
         if (isStatus(e, "UNAUTHORIZED", 401))
            throw WebAppError.unauthorized(
               "Autenticação necessária para acessar a organização.",
            );
         if (isStatus(e, "FORBIDDEN", 403))
            throw WebAppError.forbidden(
               "Permissões insuficientes para acessar a organização.",
            );
         throw WebAppError.internal("Falha ao recuperar dados da organização.");
      }
      return result.value;
   },
);

export const getOrganizationTeams = protectedProcedure.handler(
   async ({ context }) => {
      const result = await fromPromise(
         context.auth.api.listOrganizationTeams({
            headers: context.headers,
            query: { organizationId: context.organizationId },
         }),
         (e) => e,
      );
      if (result.isErr()) {
         const e = result.error;
         if (isStatus(e, "UNAUTHORIZED", 401))
            throw WebAppError.unauthorized("Autenticação necessária.");
         if (isStatus(e, "FORBIDDEN", 403))
            throw WebAppError.forbidden("Permissões insuficientes.");
         throw WebAppError.internal("Falha ao listar projetos da organização.");
      }
      return result.value.map((t) => ({
         ...t,
         slug: (t as { slug: string }).slug,
      }));
   },
);

export const getMembers = protectedProcedure.handler(async ({ context }) => {
   const result = await fromPromise(
      context.auth.api.listMembers({
         headers: context.headers,
         query: { organizationId: context.organizationId },
      }),
      () => WebAppError.internal("Falha ao listar membros."),
   );
   if (result.isErr()) throw result.error;
   return result.value.members.map((m) => ({
      id: m.id,
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      image: m.user.image ?? null,
      createdAt: new Date(m.createdAt),
   }));
});

export const getPendingInvitations = protectedProcedure.handler(
   async ({ context }) => {
      const invitations = await context.auth.api.listInvitations({
         headers: context.headers,
         query: { organizationId: context.organizationId },
      });
      return invitations
         .filter((inv) => inv.status === "pending")
         .map((inv) => ({
            id: inv.id,
            email: inv.email,
            role: inv.role ?? "member",
            status: inv.status,
            expiresAt: inv.expiresAt,
            createdAt: inv.createdAt,
         }))
         .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
   },
);

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

export const generateLogoUploadUrl = protectedProcedure
   .input(z.object({ fileExtension: z.string(), contentType: z.string() }))
   .handler(async ({ context, input }) => {
      const bucketName = "organization-logos";
      const fileName = `org-${context.organizationId}-${crypto.randomUUID()}.${input.fileExtension}`;
      const result = await fromPromise(
         generatePresignedPutUrl(
            context.minioClient,
            fileName,
            bucketName,
            300,
         ),
         () => WebAppError.internal("Falha ao gerar URL de upload."),
      );
      if (result.isErr()) throw result.error;
      return {
         presignedUrl: result.value,
         fileName,
         publicUrl: `/api/files/${bucketName}/${fileName}`,
      };
   });

export const updateLogo = protectedProcedure
   .input(z.object({ logoUrl: z.string() }))
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db
            .update(organization)
            .set({ logo: input.logoUrl })
            .where(eq(organization.id, context.organizationId))
            .then(() => undefined),
         () => WebAppError.internal("Falha ao atualizar logo."),
      );
      if (result.isErr()) throw result.error;
      return { success: true };
   });
