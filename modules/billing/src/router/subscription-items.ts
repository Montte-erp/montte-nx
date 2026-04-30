import { count, eq, sql } from "drizzle-orm";
import { errAsync, fromPromise, okAsync, safeTry } from "neverthrow";
import { z } from "zod";
import {
   createSubscriptionItemSchema,
   subscriptionItems,
   updateSubscriptionItemSchema,
} from "@core/database/schemas/subscription-items";
import { WebAppError } from "@core/logging/errors";
import { protectedProcedure } from "@core/orpc/server";
import {
   requireSubscription,
   requireSubscriptionItem,
} from "@modules/billing/router/middlewares";

const MAX_ITEMS_PER_SUBSCRIPTION = 20;

const idInputSchema = z.object({ id: z.string().uuid() });
const subscriptionIdInputSchema = z.object({
   subscriptionId: z.string().uuid(),
});
const updateItemInputSchema = z
   .object({ id: z.string().uuid() })
   .merge(updateSubscriptionItemSchema);

const ensureRow = <T>(row: T | undefined, message: string) =>
   row ? okAsync(row) : errAsync(WebAppError.internal(message));

export const list = protectedProcedure
   .input(subscriptionIdInputSchema)
   .use(requireSubscription, (input) => input.subscriptionId)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.query.subscriptionItems.findMany({
            where: (f, { eq }) => eq(f.subscriptionId, input.subscriptionId),
            orderBy: (f, { asc }) => [asc(f.createdAt)],
         }),
         () => WebAppError.internal("Falha ao listar itens da assinatura."),
      );
      if (result.isErr()) throw result.error;
      return result.value;
   });

export const add = protectedProcedure
   .input(createSubscriptionItemSchema)
   .use(requireSubscription, (input) => input.subscriptionId)
   .handler(async ({ context, input }) => {
      const result = await safeTry(async function* () {
         const outcome = yield* fromPromise(
            context.db.transaction(async (tx) => {
               const lock = await tx.execute(
                  sql`SELECT id FROM crm.contact_subscriptions WHERE id = ${input.subscriptionId} AND team_id = ${context.teamId} FOR UPDATE`,
               );
               if (lock.rows.length === 0) return "notFound" as const;

               const [countRow] = await tx
                  .select({ itemCount: count() })
                  .from(subscriptionItems)
                  .where(
                     eq(subscriptionItems.subscriptionId, input.subscriptionId),
                  );
               if ((countRow?.itemCount ?? 0) >= MAX_ITEMS_PER_SUBSCRIPTION)
                  return "limit" as const;

               const [row] = await tx
                  .insert(subscriptionItems)
                  .values({ ...input, teamId: context.teamId })
                  .returning();
               return row;
            }),
            () => WebAppError.internal("Falha ao adicionar item."),
         );
         if (outcome === "notFound")
            yield* errAsync(WebAppError.notFound("Assinatura não encontrada."));
         if (outcome === "limit")
            yield* errAsync(
               WebAppError.badRequest(
                  `Limite de ${MAX_ITEMS_PER_SUBSCRIPTION} itens por assinatura atingido.`,
               ),
            );
         return ensureRow(
            outcome === "notFound" || outcome === "limit" ? undefined : outcome,
            "Falha ao adicionar item: insert vazio.",
         );
      });
      if (result.isErr()) throw result.error;
      return result.value;
   });

export const update = protectedProcedure
   .input(updateItemInputSchema)
   .use(requireSubscriptionItem, (input) => input.id)
   .handler(async ({ context, input }) => {
      const { id, ...data } = input;
      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            const [row] = await tx
               .update(subscriptionItems)
               .set(data)
               .where(eq(subscriptionItems.id, id))
               .returning();
            return row;
         }),
         () => WebAppError.internal("Falha ao atualizar item."),
      ).andThen((row) =>
         ensureRow(row, "Falha ao atualizar item: update vazio."),
      );
      if (result.isErr()) throw result.error;
      return result.value;
   });

export const remove = protectedProcedure
   .input(idInputSchema)
   .use(requireSubscriptionItem, (input) => input.id)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            await tx
               .delete(subscriptionItems)
               .where(eq(subscriptionItems.id, input.id));
         }),
         () => WebAppError.internal("Falha ao remover item."),
      );
      if (result.isErr()) throw result.error;
      return { success: true as const };
   });
