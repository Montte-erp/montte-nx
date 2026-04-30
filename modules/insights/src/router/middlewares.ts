import { err, fromPromise, ok } from "neverthrow";
import { os } from "@orpc/server";
import { WebAppError } from "@core/logging/errors";
import type { ORPCContextWithOrganization } from "@core/orpc/context";

const base = os.$context<ORPCContextWithOrganization>();

export const requireDashboard = base.middleware(
   async ({ context, next }, id: string) => {
      const result = await fromPromise(
         context.db.query.dashboards.findFirst({
            where: (f, { eq }) => eq(f.id, id),
         }),
         () => WebAppError.internal("Falha ao verificar permissão."),
      ).andThen((dashboard) =>
         !dashboard ||
         dashboard.teamId !== context.teamId ||
         dashboard.organizationId !== context.organizationId
            ? err(WebAppError.notFound("Dashboard não encontrado."))
            : ok(dashboard),
      );
      if (result.isErr()) throw result.error;
      return next({ context: { dashboard: result.value } });
   },
);

export const requireInsight = base.middleware(
   async ({ context, next }, id: string) => {
      const result = await fromPromise(
         context.db.query.insights.findFirst({
            where: (f, { eq }) => eq(f.id, id),
         }),
         () => WebAppError.internal("Falha ao verificar permissão."),
      ).andThen((insight) =>
         !insight ||
         insight.teamId !== context.teamId ||
         insight.organizationId !== context.organizationId
            ? err(WebAppError.notFound("Insight não encontrado."))
            : ok(insight),
      );
      if (result.isErr()) throw result.error;
      return next({ context: { insight: result.value } });
   },
);

export const requireDefaultDashboard = base.middleware(
   async ({ context, next }) => {
      const result = await fromPromise(
         context.db.query.dashboards.findFirst({
            where: (f, { and, eq }) =>
               and(
                  eq(f.organizationId, context.organizationId),
                  eq(f.teamId, context.teamId),
                  eq(f.isDefault, true),
               ),
         }),
         () => WebAppError.internal("Falha ao buscar dashboard padrão."),
      ).andThen((dashboard) =>
         !dashboard
            ? err(WebAppError.notFound("Dashboard padrão não encontrado."))
            : ok(dashboard),
      );
      if (result.isErr()) throw result.error;
      return next({ context: { defaultDashboard: result.value } });
   },
);
