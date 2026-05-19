import dayjs from "dayjs";
import { eq } from "drizzle-orm";
import { Result, TaggedError } from "better-result";
import { defineErrorCatalog } from "evlog";
import { z } from "zod";
import { transactions } from "@core/database/schemas/transactions";
import { protectedProcedure } from "@core/orpc/server";
import {
   requireOwnedTransactionIds,
   requireTransaction,
} from "@modules/cashbook/router/middlewares";

const transactionStatusRouterErrors = defineErrorCatalog(
   "cashbook.router.transactionsStatus",
   {
      BAD_REQUEST: {
         status: 400,
         message: "Requisição inválida para status de lançamento.",
         tags: ["cashbook"],
      },
      CONFLICT: {
         status: 409,
         message: "Conflito no status do lançamento.",
         tags: ["cashbook"],
      },
      INTERNAL: {
         status: 500,
         message: "Falha interna no status do lançamento.",
         tags: ["cashbook"],
      },
      NOT_FOUND: {
         status: 404,
         message: "Registro não encontrado.",
         tags: ["cashbook"],
      },
   },
);

declare module "evlog" {
   interface RegisteredErrorCatalogs {
      "cashbook.router.transactionsStatus": typeof transactionStatusRouterErrors;
   }
}

type TransactionStatusRouterCatalogError =
   | ReturnType<typeof transactionStatusRouterErrors.BAD_REQUEST>
   | ReturnType<typeof transactionStatusRouterErrors.CONFLICT>
   | ReturnType<typeof transactionStatusRouterErrors.INTERNAL>
   | ReturnType<typeof transactionStatusRouterErrors.NOT_FOUND>;

class TransactionStatusRouterError extends TaggedError(
   "TransactionStatusRouterError",
)<{
   error: TransactionStatusRouterCatalogError;
   message: string;
}>() {}

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
         throw new TransactionStatusRouterError({
            error: transactionStatusRouterErrors.CONFLICT(),
            message: "Lançamento já está pago.",
         });
      }
      if (existing.ignored) {
         throw new TransactionStatusRouterError({
            error: transactionStatusRouterErrors.BAD_REQUEST(),
            message: "Lançamento ignorado não pode ser pago.",
         });
      }
      if (typeof input.bankAccountId === "string") {
         const account = await Result.tryPromise({
            try: () =>
               context.db.query.bankAccounts.findFirst({
                  where: (f, { eq }) => eq(f.id, input.bankAccountId ?? ""),
               }),
            catch: () =>
               new TransactionStatusRouterError({
                  error: transactionStatusRouterErrors.INTERNAL(),
                  message: "Falha ao verificar conta bancária.",
               }),
         });
         if (Result.isError(account)) throw account.error;
         if (!account.value || account.value.teamId !== context.teamId) {
            throw new TransactionStatusRouterError({
               error: transactionStatusRouterErrors.NOT_FOUND(),
               message: "Conta bancária não encontrada.",
            });
         }
      }
      const paidDate = input.paidDate ?? dayjs().format("YYYY-MM-DD");

      const result = await Result.tryPromise({
         try: () =>
            context.db.transaction(async (tx) =>
               tx
                  .update(transactions)
                  .set({
                     status: "paid",
                     ignored: false,
                     paidAt: dayjs().toDate(),
                     date: paidDate,
                     ...(() => {
                        if (input.bankAccountId !== undefined) {
                           return { bankAccountId: input.bankAccountId };
                        }
                        return {};
                     })(),
                  })
                  .where(eq(transactions.id, input.id))
                  .returning(),
            ),
         catch: () =>
            new TransactionStatusRouterError({
               error: transactionStatusRouterErrors.INTERNAL(),
               message: "Falha ao marcar lançamento como pago.",
            }),
      });
      if (Result.isError(result)) throw result.error;
      const [row] = result.value;
      if (!row) {
         throw new TransactionStatusRouterError({
            error: transactionStatusRouterErrors.NOT_FOUND(),
            message: "Lançamento não encontrado.",
         });
      }
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
         throw new TransactionStatusRouterError({
            error: transactionStatusRouterErrors.CONFLICT(),
            message: "Apenas lançamentos pagos podem ser desmarcados.",
         });
      }
      const result = await Result.tryPromise({
         try: () =>
            context.db.transaction(async (tx) =>
               tx
                  .update(transactions)
                  .set({ status: "pending", ignored: false, paidAt: null })
                  .where(eq(transactions.id, input.id))
                  .returning(),
            ),
         catch: () =>
            new TransactionStatusRouterError({
               error: transactionStatusRouterErrors.INTERNAL(),
               message: "Falha ao desmarcar lançamento.",
            }),
      });
      if (Result.isError(result)) throw result.error;
      const [row] = result.value;
      if (!row) {
         throw new TransactionStatusRouterError({
            error: transactionStatusRouterErrors.NOT_FOUND(),
            message: "Lançamento não encontrado.",
         });
      }
      return row;
   });

export const cancel = protectedProcedure
   .input(idSchema)
   .use(requireTransaction, (input) => input.id)
   .handler(async ({ context, input }) => {
      if (context.transaction.ignored) {
         throw new TransactionStatusRouterError({
            error: transactionStatusRouterErrors.CONFLICT(),
            message: "Lançamento já está ignorado.",
         });
      }
      const result = await Result.tryPromise({
         try: () =>
            context.db.transaction(async (tx) =>
               tx
                  .update(transactions)
                  .set({ ignored: true })
                  .where(eq(transactions.id, input.id))
                  .returning(),
            ),
         catch: () =>
            new TransactionStatusRouterError({
               error: transactionStatusRouterErrors.INTERNAL(),
               message: "Falha ao ignorar lançamento.",
            }),
      });
      if (Result.isError(result)) throw result.error;
      const [row] = result.value;
      if (!row) {
         throw new TransactionStatusRouterError({
            error: transactionStatusRouterErrors.NOT_FOUND(),
            message: "Lançamento não encontrado.",
         });
      }
      return row;
   });

export const reactivate = protectedProcedure
   .input(z.object({ id: z.string().uuid(), paid: z.boolean().default(false) }))
   .use(requireTransaction, (input) => input.id)
   .handler(async ({ context, input }) => {
      if (!context.transaction.ignored) {
         throw new TransactionStatusRouterError({
            error: transactionStatusRouterErrors.CONFLICT(),
            message: "Apenas lançamentos ignorados podem ser reativados.",
         });
      }
      const result = await Result.tryPromise({
         try: () =>
            context.db.transaction(async (tx) =>
               tx
                  .update(transactions)
                  .set({ ignored: false })
                  .where(eq(transactions.id, input.id))
                  .returning(),
            ),
         catch: () =>
            new TransactionStatusRouterError({
               error: transactionStatusRouterErrors.INTERNAL(),
               message: "Falha ao reativar lançamento.",
            }),
      });
      if (Result.isError(result)) throw result.error;
      const [row] = result.value;
      if (!row) {
         throw new TransactionStatusRouterError({
            error: transactionStatusRouterErrors.NOT_FOUND(),
            message: "Lançamento não encontrado.",
         });
      }
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
         const account = await Result.tryPromise({
            try: () =>
               context.db.query.bankAccounts.findFirst({
                  where: (f, { eq }) => eq(f.id, input.bankAccountId ?? ""),
               }),
            catch: () =>
               new TransactionStatusRouterError({
                  error: transactionStatusRouterErrors.INTERNAL(),
                  message: "Falha ao verificar conta bancária.",
               }),
         });
         if (Result.isError(account)) throw account.error;
         if (!account.value || account.value.teamId !== context.teamId) {
            throw new TransactionStatusRouterError({
               error: transactionStatusRouterErrors.NOT_FOUND(),
               message: "Conta bancária não encontrada.",
            });
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
                     ...(() => {
                        if (input.bankAccountId !== undefined) {
                           return { bankAccountId: input.bankAccountId };
                        }
                        return {};
                     })(),
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
