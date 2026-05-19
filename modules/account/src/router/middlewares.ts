import { os } from "@orpc/server";
import { Result } from "better-result";
import { cnpjDataSchema } from "@core/authentication/server";
import type { ORPCContextWithOrganization } from "@core/orpc/context";
import { AccountError, accountErrors } from "@modules/account/router/errors";

const base = os.$context<ORPCContextWithOrganization>();

export const requireOrganizationTeam = base.middleware(
   async ({ context, next }, teamId: string) => {
      const teamResult = await Result.tryPromise({
         try: () =>
            context.db.query.team.findFirst({
               where: (f, { and, eq }) =>
                  and(
                     eq(f.id, teamId),
                     eq(f.organizationId, context.organizationId),
                  ),
            }),
         catch: () =>
            new AccountError({
               error: accountErrors.INTERNAL(),
               message: "Falha ao verificar projeto.",
               organizationId: context.organizationId,
               teamId,
            }),
      });
      if (teamResult.isErr()) throw teamResult.error;

      if (!teamResult.value) {
         throw new AccountError({
            error: accountErrors.NOT_FOUND(),
            message: "Projeto não encontrado.",
            organizationId: context.organizationId,
            teamId,
         });
      }

      const team = teamResult.value;
      const parsedCnpjDataResult = await Result.try({
         try: () =>
            team.cnpjData ? cnpjDataSchema.parse(team.cnpjData) : null,
         catch: () =>
            new AccountError({
               error: accountErrors.INTERNAL(),
               message: "Falha ao processar dados do projeto.",
               organizationId: context.organizationId,
               teamId,
            }),
      });
      if (parsedCnpjDataResult.isErr()) throw parsedCnpjDataResult.error;

      return next({
         context: {
            organizationTeam: {
               ...team,
               cnpjData: parsedCnpjDataResult.value,
            },
         },
      });
   },
);
