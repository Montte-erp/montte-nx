import { os } from "@orpc/server";
import { fromPromise } from "neverthrow";
import { cnpjDataSchema } from "@core/authentication/server";
import { WebAppError } from "@core/logging/errors";
import type { ORPCContextWithOrganization } from "@core/orpc/context";

const base = os.$context<ORPCContextWithOrganization>();

export const requireOrganizationTeam = base.middleware(
   async ({ context, next }, teamId: string) => {
      const fetched = await fromPromise(
         context.db.query.team.findFirst({
            where: (f, { and, eq }) =>
               and(
                  eq(f.id, teamId),
                  eq(f.organizationId, context.organizationId),
               ),
         }),
         () => WebAppError.internal("Falha ao verificar projeto."),
      );
      if (fetched.isErr()) throw fetched.error;

      const row = fetched.value;
      if (!row) throw WebAppError.notFound("Projeto não encontrado.");

      const cnpjData = row.cnpjData ? cnpjDataSchema.parse(row.cnpjData) : null;

      return next({ context: { organizationTeam: { ...row, cnpjData } } });
   },
);
