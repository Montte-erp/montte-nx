import { implementerInternal } from "@orpc/server";
import dayjs from "dayjs";
import { count, eq, sql } from "drizzle-orm";
import { err, fromPromise, ok } from "neverthrow";
import {
   type SubscriptionItem,
   subscriptionItems,
} from "@core/database/schemas/subscription-items";
import {
   type ContactSubscription,
   contactSubscriptions,
} from "@core/database/schemas/subscriptions";
import { WebAppError } from "@core/logging/errors";
import {
   type ORPCContext,
   type ORPCContextWithOrganization,
   protectedProcedure,
} from "@core/orpc/server";
import { hyprpayContract } from "@montte/hyprpay/contract";

const MAX_ITEMS_PER_SUBSCRIPTION = 20;

const impl = implementerInternal<
   typeof hyprpayContract.subscriptions,
   ORPCContext,
   ORPCContextWithOrganization
>(hyprpayContract.subscriptions, protectedProcedure["~orpc"].config, [
   ...protectedProcedure["~orpc"].middlewares,
]);

function mapSubscription(sub: ContactSubscription) {
   return {
      id: sub.id,
      contactId: sub.contactId,
      teamId: sub.teamId,
      status: sub.status,
      startDate: sub.startDate,
      endDate: sub.endDate ?? null,
      couponId: sub.couponId ?? null,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      checkoutUrl: null,
      createdAt: sub.createdAt.toISOString(),
      updatedAt: sub.updatedAt.toISOString(),
   };
}

function mapItem(item: SubscriptionItem) {
   return {
      id: item.id,
      subscriptionId: item.subscriptionId,
      priceId: item.priceId,
      quantity: item.quantity,
      negotiatedPrice: item.negotiatedPrice ?? null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
   };
}

export const create = impl.create.handler(async ({ context, input }) => {
   const contactResult = await fromPromise(
      context.db.query.contacts.findFirst({
         where: (f, { and, eq }) =>
            and(
               eq(f.externalId, input.externalId),
               eq(f.teamId, context.teamId),
               eq(f.type, "cliente"),
            ),
      }),
      () => WebAppError.internal("Falha ao buscar cliente."),
   );
   if (contactResult.isErr()) throw contactResult.error;
   if (!contactResult.value || contactResult.value.isArchived)
      throw WebAppError.notFound("Cliente não encontrado.");
   const contact = contactResult.value;

   let couponId: string | null = null;
   if (input.couponCode) {
      const couponResult = await fromPromise(
         context.db.query.coupons.findFirst({
            where: (f, { and, eq, sql: sqlFn }) =>
               and(
                  eq(f.teamId, context.teamId),
                  sqlFn`lower(${f.code}) = lower(${input.couponCode})`,
               ),
         }),
         () => WebAppError.internal("Falha ao buscar cupom."),
      );
      if (couponResult.isErr()) throw couponResult.error;
      const coupon = couponResult.value;
      if (!coupon) throw WebAppError.badRequest("Cupom não encontrado.");
      if (!coupon.isActive) throw WebAppError.badRequest("Cupom inativo.");
      if (coupon.redeemBy && dayjs().isAfter(coupon.redeemBy))
         throw WebAppError.badRequest("Cupom expirado.");
      if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses)
         throw WebAppError.badRequest("Cupom sem usos restantes.");
      couponId = coupon.id;
   }

   const result = await fromPromise(
      context.db.transaction(async (tx) => {
         const [subscription] = await tx
            .insert(contactSubscriptions)
            .values({
               teamId: context.teamId,
               contactId: contact.id,
               startDate: dayjs().format("YYYY-MM-DD"),
               status: "active",
               couponId,
               cancelAtPeriodEnd: false,
            })
            .returning();
         if (!subscription) return null;

         for (const item of input.items) {
            const [countRow] = await tx
               .select({ value: count() })
               .from(subscriptionItems)
               .where(eq(subscriptionItems.subscriptionId, subscription.id));
            if ((countRow?.value ?? 0) >= MAX_ITEMS_PER_SUBSCRIPTION)
               throw WebAppError.badRequest(
                  `Limite de ${MAX_ITEMS_PER_SUBSCRIPTION} itens por assinatura atingido.`,
               );
            const [inserted] = await tx
               .insert(subscriptionItems)
               .values({
                  teamId: context.teamId,
                  subscriptionId: subscription.id,
                  priceId: item.priceId,
                  quantity: item.quantity ?? 1,
               })
               .returning();
            if (!inserted)
               throw WebAppError.internal(
                  "Falha ao inserir item da assinatura.",
               );
         }

         return subscription;
      }),
      (e) =>
         e instanceof WebAppError
            ? e
            : WebAppError.internal("Falha ao criar assinatura."),
   );
   if (result.isErr()) throw result.error;
   if (!result.value) throw WebAppError.internal("Falha ao criar assinatura.");

   return {
      subscription: mapSubscription(result.value),
      checkoutUrl: null,
   };
});

export const cancel = impl.cancel.handler(async ({ context, input }) => {
   const ownership = await fromPromise(
      context.db.query.contactSubscriptions.findFirst({
         where: (f, { eq }) => eq(f.id, input.subscriptionId),
      }),
      () => WebAppError.internal("Falha ao verificar permissão."),
   ).andThen((sub) =>
      !sub || sub.teamId !== context.teamId
         ? err(WebAppError.notFound("Assinatura não encontrada."))
         : ok(sub),
   );
   if (ownership.isErr()) throw ownership.error;

   const updated = await fromPromise(
      context.db.transaction(async (tx) => {
         const [row] = await tx
            .update(contactSubscriptions)
            .set(
               input.cancelAtPeriodEnd
                  ? { cancelAtPeriodEnd: true, updatedAt: dayjs().toDate() }
                  : {
                       status: "cancelled",
                       cancelAtPeriodEnd: false,
                       updatedAt: dayjs().toDate(),
                    },
            )
            .where(eq(contactSubscriptions.id, input.subscriptionId))
            .returning();
         return row;
      }),
      () => WebAppError.internal("Falha ao cancelar assinatura."),
   );
   if (updated.isErr()) throw updated.error;
   if (!updated.value)
      throw WebAppError.internal(
         "Falha ao cancelar assinatura: update retornou vazio.",
      );
   return mapSubscription(updated.value);
});

export const list = impl.list.handler(async ({ context, input }) => {
   const contactResult = await fromPromise(
      context.db.query.contacts.findFirst({
         where: (f, { and, eq }) =>
            and(
               eq(f.externalId, input.externalId),
               eq(f.teamId, context.teamId),
               eq(f.type, "cliente"),
            ),
      }),
      () => WebAppError.internal("Falha ao buscar cliente."),
   );
   if (contactResult.isErr()) throw contactResult.error;
   const contact = contactResult.value;
   if (!contact || contact.isArchived)
      throw WebAppError.notFound("Cliente não encontrado.");

   const subsResult = await fromPromise(
      context.db.query.contactSubscriptions.findMany({
         where: (f, { eq }) => eq(f.contactId, contact.id),
         orderBy: (f, { desc }) => [desc(f.createdAt)],
      }),
      () => WebAppError.internal("Falha ao listar assinaturas."),
   );
   if (subsResult.isErr()) throw subsResult.error;

   return subsResult.value.map(mapSubscription);
});

export const addItem = impl.addItem.handler(async ({ context, input }) => {
   const result = await fromPromise(
      context.db.transaction(async (tx) => {
         const lockRows = await tx.execute(
            sql`SELECT id FROM crm.contact_subscriptions WHERE id = ${input.subscriptionId} AND team_id = ${context.teamId} FOR UPDATE`,
         );
         if (lockRows.rows.length === 0)
            throw WebAppError.notFound("Assinatura não encontrada.");
         const [countRow] = await tx
            .select({ value: count() })
            .from(subscriptionItems)
            .where(eq(subscriptionItems.subscriptionId, input.subscriptionId));
         if ((countRow?.value ?? 0) >= MAX_ITEMS_PER_SUBSCRIPTION)
            throw WebAppError.badRequest(
               `Limite de ${MAX_ITEMS_PER_SUBSCRIPTION} itens por assinatura atingido.`,
            );
         const [row] = await tx
            .insert(subscriptionItems)
            .values({
               teamId: context.teamId,
               subscriptionId: input.subscriptionId,
               priceId: input.priceId,
               quantity: input.quantity ?? 1,
            })
            .returning();
         return row;
      }),
      (e) =>
         e instanceof WebAppError
            ? e
            : WebAppError.internal("Falha ao adicionar item."),
   );
   if (result.isErr()) throw result.error;
   if (!result.value)
      throw WebAppError.internal(
         "Falha ao adicionar item: insert retornou vazio.",
      );
   return mapItem(result.value);
});

export const updateItem = impl.updateItem.handler(
   async ({ context, input }) => {
      const ownership = await fromPromise(
         context.db.query.subscriptionItems.findFirst({
            where: (f, { eq }) => eq(f.id, input.itemId),
         }),
         () => WebAppError.internal("Falha ao verificar permissão."),
      ).andThen((item) =>
         !item || item.teamId !== context.teamId
            ? err(WebAppError.notFound("Item de assinatura não encontrado."))
            : ok(item),
      );
      if (ownership.isErr()) throw ownership.error;

      const updated = await fromPromise(
         context.db.transaction(async (tx) => {
            const [row] = await tx
               .update(subscriptionItems)
               .set({
                  quantity: input.quantity,
                  negotiatedPrice: input.negotiatedPrice,
                  updatedAt: dayjs().toDate(),
               })
               .where(eq(subscriptionItems.id, input.itemId))
               .returning();
            return row;
         }),
         () => WebAppError.internal("Falha ao atualizar item."),
      );
      if (updated.isErr()) throw updated.error;
      if (!updated.value)
         throw WebAppError.internal(
            "Falha ao atualizar item: update retornou vazio.",
         );
      return mapItem(updated.value);
   },
);

export const removeItem = impl.removeItem.handler(
   async ({ context, input }) => {
      const ownership = await fromPromise(
         context.db.query.subscriptionItems.findFirst({
            where: (f, { eq }) => eq(f.id, input.itemId),
         }),
         () => WebAppError.internal("Falha ao verificar permissão."),
      ).andThen((item) =>
         !item || item.teamId !== context.teamId
            ? err(WebAppError.notFound("Item de assinatura não encontrado."))
            : ok(item),
      );
      if (ownership.isErr()) throw ownership.error;

      const removed = await fromPromise(
         context.db.transaction(async (tx) => {
            await tx
               .delete(subscriptionItems)
               .where(eq(subscriptionItems.id, input.itemId));
         }),
         () => WebAppError.internal("Falha ao remover item."),
      );
      if (removed.isErr()) throw removed.error;
      return { success: true };
   },
);
