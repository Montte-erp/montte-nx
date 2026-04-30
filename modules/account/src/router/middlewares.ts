import { os } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import { err, fromPromise, ok } from "neverthrow";
import { cnpjDataSchema } from "@core/authentication/server";
import { team } from "@core/database/schemas/auth";
import { WebAppError } from "@core/logging/errors";
import type { ORPCContextWithOrganization } from "@core/orpc/context";

const base = os.$context<ORPCContextWithOrganization>();

export const requireOrganizationTeam = base.middleware(
   async ({ context, next }, teamId: string) => {
      const result = await fromPromise(
         context.db
            .select({
               id: team.id,
               name: team.name,
               description: team.description,
               createdAt: team.createdAt,
               updatedAt: team.updatedAt,
               cnpjData: team.cnpjData,
               slug: team.slug,
            })
            .from(team)
            .where(
               and(
                  eq(team.id, teamId),
                  eq(team.organizationId, context.organizationId),
               ),
            )
            .limit(1)
            .then((rows) => rows[0]),
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
