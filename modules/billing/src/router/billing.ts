import { fromPromise } from "neverthrow";
import { WebAppError } from "@core/logging/errors";
import { protectedProcedure } from "@core/orpc/server";
import {
   getUsageSummaryInputSchema,
   getCustomerPortalSessionInputSchema,
} from "../contracts/billing";

export const getEventCatalog = protectedProcedure.handler(
   async ({ context }) => {
      const result = await fromPromise(
         context.db.query.eventCatalog.findMany({
            orderBy: (t, { asc }) => [asc(t.category), asc(t.displayName)],
         }),
         () => WebAppError.internal("Falha ao buscar catálogo de eventos."),
      );
      return result.match(
         (rows) => rows,
         (e) => {
            throw e;
         },
      );
   },
);

export const getUsageSummary = protectedProcedure
   .input(getUsageSummaryInputSchema)
   .handler(async ({ context, input }) => {
      const result = await context.hyprpayClient.usage.list({
         customerId: input.customerId,
      });

      return result.match(
         (events) => events,
         () => {
            throw WebAppError.internal("Falha ao buscar uso.");
         },
      );
   });

export const getCustomerPortalSession = protectedProcedure
   .input(getCustomerPortalSessionInputSchema)
   .handler(async ({ context, input }) => {
      const result = await context.hyprpayClient.customerPortal.createSession(
         input.customerId,
      );

      return result.match(
         (session) => session,
         () => {
            throw WebAppError.internal("Falha ao criar sessão do portal.");
         },
      );
   });
