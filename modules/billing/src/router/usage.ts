import { fromPromise } from "neverthrow";
import { billingContract } from "@montte/hyprpay/contract";
import { implementerInternal } from "@orpc/server";
import { usageEvents } from "@core/database/schemas/usage-events";
import { WebAppError } from "@core/logging/errors";
import { protectedProcedure } from "@core/orpc/server";
import type {
   ORPCContext,
   ORPCContextWithOrganization,
} from "@core/orpc/server";

const def = protectedProcedure["~orpc"];
const impl = implementerInternal<
   typeof billingContract.services,
   ORPCContext,
   ORPCContextWithOrganization
>(billingContract.services, def.config, [...def.middlewares]);

export const ingestUsage = impl.ingestUsage.handler(
   async ({ context, input }) => {
      const teamId = context.teamId;

      const meterResult = await fromPromise(
         input.meterId
            ? context.db.query.meters.findFirst({
                 where: (f, { and: a, eq: e }) =>
                    a(e(f.id, input.meterId!), e(f.teamId, teamId)),
                 columns: { id: true },
              })
            : context.db.query.meters.findFirst({
                 where: (f, { and: a, eq: e }) =>
                    a(
                       e(f.teamId, teamId),
                       e(f.eventName, input.eventName!),
                       e(f.isActive, true),
                    ),
                 columns: { id: true },
              }),
         () => WebAppError.internal("Falha ao buscar meter."),
      );
      if (meterResult.isErr()) throw meterResult.error;
      const meter = meterResult.value;
      if (!meter) return { success: true as const };

      let contactId: string | null = null;
      if (input.externalId) {
         const contactResult = await fromPromise(
            context.db.query.contacts.findFirst({
               where: (f, { and: a, eq: e }) =>
                  a(e(f.teamId, teamId), e(f.externalId, input.externalId!)),
               columns: { id: true },
            }),
            () => WebAppError.internal("Falha ao buscar contato."),
         );
         if (contactResult.isErr()) throw contactResult.error;
         contactId = contactResult.value?.id ?? null;
      }

      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            await tx
               .insert(usageEvents)
               .values({
                  teamId,
                  meterId: meter.id,
                  quantity: input.quantity,
                  idempotencyKey: input.idempotencyKey,
                  contactId,
                  properties: input.properties ?? {},
               })
               .onConflictDoNothing({
                  target: [usageEvents.teamId, usageEvents.idempotencyKey],
               });
         }),
         () => WebAppError.internal("Falha ao registrar evento de uso."),
      );
      if (result.isErr()) throw result.error;
      return { success: true as const };
   },
);
