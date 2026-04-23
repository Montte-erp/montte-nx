import { AppError, validateInput } from "@core/logging/errors";
import { count, eq } from "drizzle-orm";
import { fromPromise, fromThrowable, ok, err } from "neverthrow";
import type { DatabaseInstance } from "@core/database/client";
import {
   type CreateSubscriptionItemInput,
   type UpdateSubscriptionItemInput,
   createSubscriptionItemSchema,
   updateSubscriptionItemSchema,
   subscriptionItems,
} from "@core/database/schemas/subscription-items";

const MAX_ITEMS_PER_SUBSCRIPTION = 20;

const safeValidateCreate = fromThrowable(
   (data: CreateSubscriptionItemInput) =>
      validateInput(createSubscriptionItemSchema, data),
   (e) => AppError.validation("Dados inválidos.", { cause: e }),
);

const safeValidateUpdate = fromThrowable(
   (data: UpdateSubscriptionItemInput) =>
      validateInput(updateSubscriptionItemSchema, data),
   (e) => AppError.validation("Dados inválidos.", { cause: e }),
);

export function addSubscriptionItem(
   db: DatabaseInstance,
   teamId: string,
   data: CreateSubscriptionItemInput,
) {
   return safeValidateCreate(data).asyncAndThen((validated) =>
      fromPromise(
         db.transaction(async (tx) => {
            const rows = await tx
               .select({ itemCount: count() })
               .from(subscriptionItems)
               .where(
                  eq(
                     subscriptionItems.subscriptionId,
                     validated.subscriptionId,
                  ),
               );
            const itemCount = rows[0]?.itemCount ?? 0;
            if (itemCount >= MAX_ITEMS_PER_SUBSCRIPTION)
               throw AppError.validation(
                  `Limite de ${MAX_ITEMS_PER_SUBSCRIPTION} itens por assinatura atingido.`,
               );
            const [row] = await tx
               .insert(subscriptionItems)
               .values({ ...validated, teamId })
               .returning();
            if (!row) throw AppError.database("Falha ao adicionar item.");
            return row;
         }),
         (e) => AppError.database("Falha ao adicionar item.", { cause: e }),
      ),
   );
}

export function updateSubscriptionItemQuantity(
   db: DatabaseInstance,
   id: string,
   data: UpdateSubscriptionItemInput,
) {
   return safeValidateUpdate(data).asyncAndThen((validated) =>
      fromPromise(
         db.transaction(async (tx) => {
            const [row] = await tx
               .update(subscriptionItems)
               .set(validated)
               .where(eq(subscriptionItems.id, id))
               .returning();
            if (!row)
               throw AppError.notFound("Item de assinatura não encontrado.");
            return row;
         }),
         (e) => AppError.database("Falha ao atualizar item.", { cause: e }),
      ),
   );
}

export function removeSubscriptionItem(db: DatabaseInstance, id: string) {
   return fromPromise(
      db.transaction(async (tx) => {
         await tx.delete(subscriptionItems).where(eq(subscriptionItems.id, id));
      }),
      (e) => AppError.database("Falha ao remover item.", { cause: e }),
   ).map(() => undefined);
}

export function listSubscriptionItems(
   db: DatabaseInstance,
   subscriptionId: string,
) {
   return fromPromise(
      db.query.subscriptionItems.findMany({
         where: (fields, { eq }) => eq(fields.subscriptionId, subscriptionId),
         orderBy: (fields, { asc }) => [asc(fields.createdAt)],
      }),
      (e) =>
         AppError.database("Falha ao listar itens da assinatura.", {
            cause: e,
         }),
   );
}

export function ensureSubscriptionItemOwnership(
   db: DatabaseInstance,
   id: string,
   teamId: string,
) {
   return fromPromise(
      db.query.subscriptionItems.findFirst({
         where: (fields, { eq }) => eq(fields.id, id),
      }),
      (e) => AppError.database("Falha ao buscar item.", { cause: e }),
   ).andThen((item) => {
      if (!item || item.teamId !== teamId)
         return err(AppError.notFound("Item de assinatura não encontrado."));
      return ok(item);
   });
}
