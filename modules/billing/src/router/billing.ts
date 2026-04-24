import { fromPromise } from "neverthrow";
import type { DatabaseInstance } from "@core/database/client";
import { WebAppError } from "@core/logging/errors";
import { protectedProcedure } from "@core/orpc/server";
import type { HyprPayClient } from "@montte/hyprpay";
import {
   getUsageSummaryInputSchema,
   getCustomerPortalSessionInputSchema,
} from "../contracts/billing";

const listEventCatalog = (db: DatabaseInstance) =>
   fromPromise(
      db.query.eventCatalog.findMany({
         orderBy: (t, { asc }) => [asc(t.category), asc(t.displayName)],
      }),
      () => WebAppError.internal("Falha ao buscar catálogo de eventos."),
   );

const listUsage = (client: HyprPayClient, customerId: string) =>
   client.usage
      .list({ customerId })
      .mapErr(() => WebAppError.internal("Falha ao buscar uso."));

const createPortalSession = (client: HyprPayClient, customerId: string) =>
   client.customerPortal
      .createSession(customerId)
      .mapErr(() => WebAppError.internal("Falha ao criar sessão do portal."));

export const getEventCatalog = protectedProcedure.handler(
   async ({ context }) => {
      const result = await listEventCatalog(context.db);
      if (result.isErr()) throw result.error;
      return result.value;
   },
);

export const getUsageSummary = protectedProcedure
   .input(getUsageSummaryInputSchema)
   .handler(async ({ context, input }) => {
      const result = await listUsage(context.hyprpayClient, input.customerId);
      if (result.isErr()) throw result.error;
      return result.value;
   });

export const getCustomerPortalSession = protectedProcedure
   .input(getCustomerPortalSessionInputSchema)
   .handler(async ({ context, input }) => {
      const result = await createPortalSession(
         context.hyprpayClient,
         input.customerId,
      );
      if (result.isErr()) throw result.error;
      return result.value;
   });
