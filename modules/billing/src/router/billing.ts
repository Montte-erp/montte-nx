import { fromPromise } from "neverthrow";
import { eventCatalog } from "@core/database/schemas/event-catalog";
import { WebAppError } from "@core/logging/errors";
import { protectedProcedure } from "@core/orpc/server";
import { z } from "zod";

export const getEventCatalog = protectedProcedure.handler(
   async ({ context }) => {
      const result = await fromPromise(
         context.db
            .select()
            .from(eventCatalog)
            .orderBy(eventCatalog.category, eventCatalog.displayName),
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
   .input(z.object({ customerId: z.string() }))
   .handler(async ({ context, input }) => {
      if (!context.hyprpayClient)
         throw WebAppError.internal("HyprPay não está configurado.");

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
   .input(z.object({ customerId: z.string() }))
   .handler(async ({ context, input }) => {
      if (!context.hyprpayClient)
         throw WebAppError.internal("HyprPay não está configurado.");

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
