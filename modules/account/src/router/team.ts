import dayjs from "dayjs";
import { and, eq } from "drizzle-orm";
import { Result } from "better-result";
import { z } from "zod";
import { teamMember } from "@core/database/schemas/auth";
import { protectedProcedure } from "@core/orpc/server";
import { AccountError, accountErrors } from "@modules/account/router/errors";
import { requireOrganizationTeam } from "@modules/account/router/middlewares";

const teamIdSchema = z.object({ teamId: z.uuid() });

export const get = protectedProcedure
   .input(teamIdSchema)
   .use(requireOrganizationTeam, (input) => input.teamId)
   .handler(async ({ context }) => context.organizationTeam);

export const getMembers = protectedProcedure
   .input(teamIdSchema)
   .use(requireOrganizationTeam, (input) => input.teamId)
   .handler(async ({ context, input }) => {
      const orgMembersResult = await Result.tryPromise({
         try: () =>
            context.auth.api.listMembers({
               headers: context.headers,
               query: { organizationId: context.organizationId },
            }),
         catch: () =>
            new AccountError({
               error: accountErrors.INTERNAL(),
               message: "Falha ao listar membros da organização.",
               organizationId: context.organizationId,
               teamId: input.teamId,
            }),
      });
      if (orgMembersResult.isErr()) throw orgMembersResult.error;

      const recordsResult = await Result.tryPromise({
         try: () =>
            context.db.query.teamMember.findMany({
               where: (f, { eq }) => eq(f.teamId, input.teamId),
            }),
         catch: () =>
            new AccountError({
               error: accountErrors.INTERNAL(),
               message: "Falha ao carregar membros do espaço.",
               organizationId: context.organizationId,
               teamId: input.teamId,
            }),
      });
      if (recordsResult.isErr()) throw recordsResult.error;

      const ids = new Set(recordsResult.value.map((tm) => tm.userId));
      return orgMembersResult.value.members
         .filter((m) => ids.has(m.userId))
         .map((m) => ({
            id: m.userId,
            name: m.user.name,
            email: m.user.email,
            role: m.role,
            image: m.user.image,
            createdAt: new Date(m.createdAt),
         }));
   });

export const addMember = protectedProcedure
   .input(z.object({ teamId: z.uuid(), userId: z.uuid() }))
   .use(requireOrganizationTeam, (input) => input.teamId)
   .handler(async ({ context, input }) => {
      const orgMemberResult = await Result.tryPromise({
         try: () =>
            context.db.query.member.findFirst({
               where: (f, { and, eq }) =>
                  and(
                     eq(f.organizationId, context.organizationId),
                     eq(f.userId, input.userId),
                  ),
            }),
         catch: () =>
            new AccountError({
               error: accountErrors.INTERNAL(),
               message: "Falha ao verificar vínculo do usuário.",
               organizationId: context.organizationId,
               teamId: input.teamId,
               userId: input.userId,
            }),
      });
      if (orgMemberResult.isErr()) throw orgMemberResult.error;
      if (!orgMemberResult.value) {
         throw new AccountError({
            error: accountErrors.BAD_REQUEST(),
            message: "Usuário precisa ser membro da organização.",
            organizationId: context.organizationId,
            teamId: input.teamId,
            userId: input.userId,
         });
      }

      const existingResult = await Result.tryPromise({
         try: () =>
            context.db.query.teamMember.findFirst({
               where: (f, { and, eq }) =>
                  and(eq(f.teamId, input.teamId), eq(f.userId, input.userId)),
            }),
         catch: () =>
            new AccountError({
               error: accountErrors.INTERNAL(),
               message: "Falha ao verificar membro do espaço.",
               organizationId: context.organizationId,
               teamId: input.teamId,
               userId: input.userId,
            }),
      });
      if (existingResult.isErr()) throw existingResult.error;
      if (existingResult.value) {
         throw new AccountError({
            error: accountErrors.BAD_REQUEST(),
            message: "Usuário já é membro do projeto.",
            organizationId: context.organizationId,
            teamId: input.teamId,
            userId: input.userId,
         });
      }

      const result = await Result.tryPromise({
         try: () =>
            context.db.transaction(async (tx) =>
               tx
                  .insert(teamMember)
                  .values({
                     teamId: input.teamId,
                     userId: input.userId,
                     createdAt: dayjs().toDate(),
                  })
                  .returning()
                  .then((rows) => rows[0]),
            ),
         catch: () =>
            new AccountError({
               error: accountErrors.INTERNAL(),
               message: "Falha ao adicionar membro.",
               organizationId: context.organizationId,
               teamId: input.teamId,
               userId: input.userId,
            }),
      });
      if (result.isErr()) throw result.error;

      if (!result.value) {
         throw new AccountError({
            error: accountErrors.INTERNAL(),
            message: "Falha ao adicionar membro: insert vazio.",
            organizationId: context.organizationId,
            teamId: input.teamId,
            userId: input.userId,
         });
      }

      return result.value;
   });

export const removeMember = protectedProcedure
   .input(z.object({ teamId: z.uuid(), userId: z.uuid() }))
   .use(requireOrganizationTeam, (input) => input.teamId)
   .handler(async ({ context, input }) => {
      const result = await Result.tryPromise({
         try: () =>
            context.db.transaction(async (tx) => {
               await tx
                  .delete(teamMember)
                  .where(
                     and(
                        eq(teamMember.teamId, input.teamId),
                        eq(teamMember.userId, input.userId),
                     ),
                  );
            }),
         catch: () =>
            new AccountError({
               error: accountErrors.INTERNAL(),
               message: "Falha ao remover membro.",
               organizationId: context.organizationId,
               teamId: input.teamId,
               userId: input.userId,
            }),
      });
      if (result.isErr()) throw result.error;
      return { success: true };
   });
