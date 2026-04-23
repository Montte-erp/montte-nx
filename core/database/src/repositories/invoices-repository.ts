import { AppError } from "@core/logging/errors";
import { desc, eq } from "drizzle-orm";
import { fromPromise, err, ok } from "neverthrow";
import type { DatabaseInstance } from "@core/database/client";
import { invoices, type NewInvoice } from "@core/database/schemas/invoices";

export function createInvoice(
   db: DatabaseInstance,
   data: Omit<NewInvoice, "id" | "createdAt" | "updatedAt">,
) {
   return fromPromise(
      db.transaction(async (tx) => {
         const [row] = await tx.insert(invoices).values(data).returning();
         if (!row) throw AppError.database("Falha ao criar fatura.");
         return row;
      }),
      (e) =>
         e instanceof AppError
            ? e
            : AppError.database("Falha ao criar fatura.", { cause: e }),
   );
}

export function getInvoice(db: DatabaseInstance, id: string) {
   return fromPromise(
      db.query.invoices.findFirst({
         where: (fields, { eq }) => eq(fields.id, id),
      }),
      (e) => AppError.database("Falha ao buscar fatura.", { cause: e }),
   ).andThen((row) => {
      if (!row) return err(AppError.notFound("Fatura não encontrada."));
      return ok(row);
   });
}

export function listInvoicesBySubscription(
   db: DatabaseInstance,
   subscriptionId: string,
) {
   return fromPromise(
      db
         .select()
         .from(invoices)
         .where(eq(invoices.subscriptionId, subscriptionId))
         .orderBy(desc(invoices.periodEnd)),
      (e) => AppError.database("Falha ao listar faturas.", { cause: e }),
   );
}

export function markInvoicePaid(db: DatabaseInstance, id: string) {
   return fromPromise(
      db.transaction(async (tx) => {
         const [row] = await tx
            .update(invoices)
            .set({ status: "paid" })
            .where(eq(invoices.id, id))
            .returning();
         if (!row) throw AppError.notFound("Fatura não encontrada.");
         return row;
      }),
      (e) =>
         e instanceof AppError
            ? e
            : AppError.database("Falha ao marcar fatura como paga.", {
                 cause: e,
              }),
   );
}
