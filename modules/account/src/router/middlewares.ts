import { os } from "@orpc/server";
import { err, fromPromise, ok } from "neverthrow";
import { cnpjDataSchema } from "@core/authentication/server";
import { WebAppError } from "@core/logging/errors";
import type { ORPCContextWithOrganization } from "@core/orpc/context";

const base = os.$context<ORPCContextWithOrganization>();

export const requireOrganizationTeam = base.middleware(
   async ({ context, next }, teamId: string) => {
      const result = await fromPromise(
         context.db.query.team.findFirst({
            where: (f, { and, eq }) =>
               and(
                  eq(f.id, teamId),
                  eq(f.organizationId, context.organizationId),
               ),
         }),
         () => WebAppError.internal("Falha ao verificar projeto."),
      ).andThen((row) =>
         !row
            ? err(WebAppError.notFound("Projeto não encontrado."))
            : ok({
                 ...row,
                 cnpjData: row.cnpjData
                    ? cnpjDataSchema.parse(row.cnpjData)
                    : null,
              }),
      );
      if (result.isErr()) throw result.error;
      return next({ context: { organizationTeam: result.value } });
   },
);
