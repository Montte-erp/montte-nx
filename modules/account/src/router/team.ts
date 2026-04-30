import dayjs from "dayjs";
import { and, eq } from "drizzle-orm";
import { fromPromise } from "neverthrow";
import { z } from "zod";
import { teamMember } from "@core/database/schemas/auth";
import { WebAppError } from "@core/logging/errors";
import { protectedProcedure } from "@core/orpc/server";
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
      const orgMembers = await context.auth.api.listMembers({
         headers: context.headers,
         query: { organizationId: context.organizationId },
      });
      const records = await context.db.query.teamMember.findMany({
         where: (f, { eq }) => eq(f.teamId, input.teamId),
      });
      const ids = new Set(records.map((tm) => tm.userId));
      return orgMembers.members
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
      const orgMember = await context.db.query.member.findFirst({
         where: (f, { and, eq }) =>
            and(
               eq(f.organizationId, context.organizationId),
               eq(f.userId, input.userId),
            ),
      });
      if (!orgMember)
         throw WebAppError.badRequest(
            "Usuário precisa ser membro da organização.",
         );

      const existing = await context.db.query.teamMember.findFirst({
         where: (f, { and, eq }) =>
            and(eq(f.teamId, input.teamId), eq(f.userId, input.userId)),
      });
      if (existing)
         throw WebAppError.badRequest("Usuário já é membro do projeto.");

      const result = await fromPromise(
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
         () => WebAppError.internal("Falha ao adicionar membro."),
      );
      if (result.isErr()) throw result.error;
      if (!result.value)
         throw WebAppError.internal("Falha ao adicionar membro: insert vazio.");
      return result.value;
   });

export const removeMember = protectedProcedure
   .input(z.object({ teamId: z.uuid(), userId: z.uuid() }))
   .use(requireOrganizationTeam, (input) => input.teamId)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
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
         () => WebAppError.internal("Falha ao remover membro."),
      );
      if (result.isErr()) throw result.error;
      return { success: true };
   });
