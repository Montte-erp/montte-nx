import dayjs from "dayjs";
import { eq } from "drizzle-orm";
import { fromPromise } from "neverthrow";
import { z } from "zod";
import { transactions } from "@core/database/schemas/transactions";
import { WebAppError } from "@core/logging/errors";
import { protectedProcedure } from "@core/orpc/server";
import {
   requireOwnedTransactionIds,
   requireTransaction,
} from "@modules/finance/router/middlewares";

const idSchema = z.object({ id: z.string().uuid() });

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const markAsPaid = protectedProcedure
   .input(
      z.object({
         id: z.string().uuid(),
         paidDate: dateSchema.optional(),
         bankAccountId: z.string().uuid().nullable().optional(),
      }),
   )
   .use(requireTransaction, (input) => input.id)
   .handler(async ({ context, input }) => {
      const existing = context.transaction;
      if (existing.status === "paid" && !existing.ignored) {
         throw WebAppError.conflict("Lançamento já está pago.");
      }
      if (existing.ignored) {
         throw WebAppError.badRequest("Lançamento ignorado não pode ser pago.");
      }
      if (typeof input.bankAccountId === "string") {
         const account = await fromPromise(
            context.db.query.bankAccounts.findFirst({
               where: (f, { eq }) => eq(f.id, input.bankAccountId ?? ""),
            }),
            () => WebAppError.internal("Falha ao verificar conta bancária."),
         );
         if (account.isErr()) throw account.error;
         if (!account.value || account.value.teamId !== context.teamId) {
            throw WebAppError.notFound("Conta bancária não encontrada.");
         }
      }
      const paidDate = input.paidDate ?? dayjs().format("YYYY-MM-DD");

      const result = await fromPromise(
         context.db.transaction(async (tx) =>
            tx
               .update(transactions)
               .set({
                  status: "paid",
                  ignored: false,
                  paidAt: dayjs().toDate(),
                  date: paidDate,
                  ...(input.bankAccountId !== undefined
                     ? { bankAccountId: input.bankAccountId }
                     : {}),
               })
               .where(eq(transactions.id, input.id))
               .returning(),
         ),
         () => WebAppError.internal("Falha ao marcar lançamento como pago."),
      );
      if (result.isErr()) throw result.error;
      const [row] = result.value;
      if (!row) throw WebAppError.notFound("Lançamento não encontrado.");
      return row;
   });

export const markAsUnpaid = protectedProcedure
   .input(idSchema)
   .use(requireTransaction, (input) => input.id)
   .handler(async ({ context, input }) => {
      if (
         context.transaction.status !== "paid" ||
         context.transaction.ignored
      ) {
         throw WebAppError.conflict(
            "Apenas lançamentos pagos podem ser desmarcados.",
         );
      }
      const result = await fromPromise(
         context.db.transaction(async (tx) =>
            tx
               .update(transactions)
               .set({ status: "pending", ignored: false, paidAt: null })
               .where(eq(transactions.id, input.id))
               .returning(),
         ),
         () => WebAppError.internal("Falha ao desmarcar lançamento."),
      );
      if (result.isErr()) throw result.error;
      const [row] = result.value;
      if (!row) throw WebAppError.notFound("Lançamento não encontrado.");
      return row;
   });

export const cancel = protectedProcedure
   .input(idSchema)
   .use(requireTransaction, (input) => input.id)
   .handler(async ({ context, input }) => {
      if (context.transaction.ignored) {
         throw WebAppError.conflict("Lançamento já está ignorado.");
      }
      const result = await fromPromise(
         context.db.transaction(async (tx) =>
            tx
               .update(transactions)
               .set({ ignored: true })
               .where(eq(transactions.id, input.id))
               .returning(),
         ),
         () => WebAppError.internal("Falha ao ignorar lançamento."),
      );
      if (result.isErr()) throw result.error;
      const [row] = result.value;
      if (!row) throw WebAppError.notFound("Lançamento não encontrado.");
      return row;
   });

export const reactivate = protectedProcedure
   .input(z.object({ id: z.string().uuid(), paid: z.boolean().default(false) }))
   .use(requireTransaction, (input) => input.id)
   .handler(async ({ context, input }) => {
      if (!context.transaction.ignored) {
         throw WebAppError.conflict(
            "Apenas lançamentos ignorados podem ser reativados.",
         );
      }
      const result = await fromPromise(
         context.db.transaction(async (tx) =>
            tx
               .update(transactions)
               .set({ ignored: false })
               .where(eq(transactions.id, input.id))
               .returning(),
         ),
         () => WebAppError.internal("Falha ao reativar lançamento."),
      );
      if (result.isErr()) throw result.error;
      const [row] = result.value;
      if (!row) throw WebAppError.notFound("Lançamento não encontrado.");
      return row;
   });

export const bulkMarkAsPaid = protectedProcedure
   .input(
      z.object({
         ids: z.array(z.string().uuid()).min(1).max(500),
         paidDate: dateSchema.optional(),
         bankAccountId: z.string().uuid().nullable().optional(),
      }),
   )
   .use(requireOwnedTransactionIds, (input) => input.ids)
   .handler(async ({ context, input }) => {
      if (typeof input.bankAccountId === "string") {
         const account = await fromPromise(
            context.db.query.bankAccounts.findFirst({
               where: (f, { eq }) => eq(f.id, input.bankAccountId ?? ""),
            }),
            () => WebAppError.internal("Falha ao verificar conta bancária."),
         );
         if (account.isErr()) throw account.error;
         if (!account.value || account.value.teamId !== context.teamId) {
            throw WebAppError.notFound("Conta bancária não encontrada.");
         }
      }
      const paidDate = input.paidDate ?? dayjs().format("YYYY-MM-DD");
      const results = await Promise.allSettled(
         input.ids.map((id) =>
            context.db.transaction(async (tx) =>
               tx
                  .update(transactions)
                  .set({
                     status: "paid",
                     ignored: false,
                     paidAt: dayjs().toDate(),
                     date: paidDate,
                     ...(input.bankAccountId !== undefined
                        ? { bankAccountId: input.bankAccountId }
                        : {}),
                  })
                  .where(eq(transactions.id, id))
                  .returning(),
            ),
         ),
      );
      return {
         succeeded: results.filter((r) => r.status === "fulfilled").length,
         failed: results.filter((r) => r.status === "rejected").length,
      };
   });
