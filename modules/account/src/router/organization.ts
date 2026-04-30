import { eq } from "drizzle-orm";
import { fromPromise } from "neverthrow";
import { z } from "zod";
import { organization } from "@core/database/schemas/auth";
import { generatePresignedPutUrl } from "@core/files/client";
import { WebAppError } from "@core/logging/errors";
import { authenticatedProcedure, protectedProcedure } from "@core/orpc/server";

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
      ).andThen((org) =>
         !org
            ? fromPromise(Promise.resolve(null), () => WebAppError.internal(""))
            : fromPromise(
                 context.auth.api.listOrganizationTeams({
                    headers: context.headers,
                    query: { organizationId: org.id },
                 }),
                 authError("Falha ao recuperar projetos da organização."),
              ).map((teams) => ({
                 ...org,
                 activeSubscription: null,
                 projectLimit: 1,
                 projectCount: teams.length,
              })),
      );
      if (result.isErr()) throw result.error;
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
         authError("Falha ao listar projetos da organização."),
      );
      if (result.isErr()) throw result.error;
      return result.value;
   },
);

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
      createdAt: new Date(m.createdAt),
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
         context.db.transaction(async (tx) => {
            await tx
               .update(organization)
               .set({ logo: input.logoUrl })
               .where(eq(organization.id, context.organizationId));
         }),
         () => WebAppError.internal("Falha ao atualizar logo."),
      );
      if (result.isErr()) throw result.error;
      return { success: true };
   });
