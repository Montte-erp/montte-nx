import { fromPromise } from "neverthrow";
import { WebAppError } from "@core/logging/errors";
import { protectedProcedure } from "@core/orpc/server";

export const getEventCatalog = protectedProcedure.handler(
   async ({ context }) => {
      const result = await fromPromise(
         context.db.query.eventCatalog.findMany({
            orderBy: (t, { asc }) => [asc(t.category), asc(t.displayName)],
         }),
         () => WebAppError.internal("Falha ao buscar catálogo de eventos."),
      );
      if (result.isErr()) throw result.error;
      return result.value;
   },
);

export const getUsageSummary = protectedProcedure.handler(
   async ({ context }) => {
      const result = await context.hyprpayClient.usage
         .list({ externalId: context.organizationId })
         .mapErr(() => WebAppError.internal("Falha ao buscar uso."));
      if (result.isErr()) throw result.error;
      return result.value;
   },
);

export const getCustomerPortalSession = protectedProcedure.handler(
   async ({ context }) => {
      const result = await context.hyprpayClient.customerPortal
         .createSession(context.organizationId)
         .mapErr(() =>
            WebAppError.internal("Falha ao criar sessão do portal."),
         );
      if (result.isErr()) throw result.error;
      return result.value;
   },
);
