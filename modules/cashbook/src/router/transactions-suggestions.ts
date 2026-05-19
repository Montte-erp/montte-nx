import dayjs from "dayjs";
import { eq } from "drizzle-orm";
import { Result, TaggedError } from "better-result";
import { defineErrorCatalog } from "evlog";
import { z } from "zod";
import { transactions } from "@core/database/schemas/transactions";
import { protectedProcedure } from "@core/orpc/server";
import { requireTransaction } from "@modules/cashbook/router/middlewares";

const transactionSuggestionRouterErrors = defineErrorCatalog(
   "cashbook.router.transactionsSuggestions",
   {
      BAD_REQUEST: {
         status: 400,
         message: "Sugestão de lançamento inválida.",
         tags: ["cashbook"],
      },
      INTERNAL: {
         status: 500,
         message: "Falha interna em sugestão de lançamento.",
         tags: ["cashbook"],
      },
   },
);

declare module "evlog" {
   interface RegisteredErrorCatalogs {
      "cashbook.router.transactionsSuggestions": typeof transactionSuggestionRouterErrors;
   }
}

type TransactionSuggestionRouterCatalogError =
   | ReturnType<typeof transactionSuggestionRouterErrors.BAD_REQUEST>
   | ReturnType<typeof transactionSuggestionRouterErrors.INTERNAL>;

class TransactionSuggestionRouterError extends TaggedError(
   "TransactionSuggestionRouterError",
)<{
   error: TransactionSuggestionRouterCatalogError;
   message: string;
}>() {}

const idSchema = z.object({ id: z.string().uuid() });

export const acceptSuggestedCategory = protectedProcedure
   .input(idSchema)
   .use(requireTransaction, (input) => input.id)
   .handler(async ({ context, input }) => {
      const current = context.transaction;
      if (!current.suggestedCategoryId) {
         throw new TransactionSuggestionRouterError({
            error: transactionSuggestionRouterErrors.BAD_REQUEST(),
            message: "Nenhuma sugestão de categoria disponível.",
         });
      }
      const result = await Result.tryPromise({
         try: () =>
            context.db.transaction(async (tx) =>
               tx
                  .update(transactions)
                  .set({
                     categoryId: current.suggestedCategoryId,
                     suggestedCategoryId: null,
                     updatedAt: dayjs().toDate(),
                  })
                  .where(eq(transactions.id, input.id)),
            ),
         catch: () =>
            new TransactionSuggestionRouterError({
               error: transactionSuggestionRouterErrors.INTERNAL(),
               message: "Falha ao atualizar categoria do lançamento.",
            }),
      });
      if (Result.isError(result)) throw result.error;
      return { ok: true };
   });

export const dismissSuggestedCategory = protectedProcedure
   .input(idSchema)
   .use(requireTransaction, (input) => input.id)
   .handler(async ({ context, input }) => {
      const result = await Result.tryPromise({
         try: () =>
            context.db.transaction(async (tx) =>
               tx
                  .update(transactions)
                  .set({
                     suggestedCategoryId: null,
                     updatedAt: dayjs().toDate(),
                  })
                  .where(eq(transactions.id, input.id)),
            ),
         catch: () =>
            new TransactionSuggestionRouterError({
               error: transactionSuggestionRouterErrors.INTERNAL(),
               message: "Falha ao descartar sugestão.",
            }),
      });
      if (Result.isError(result)) throw result.error;
      return { ok: true };
   });

export const acceptSuggestedTag = protectedProcedure
   .input(idSchema)
   .use(requireTransaction, (input) => input.id)
   .handler(async ({ context, input }) => {
      const current = context.transaction;
      if (!current.suggestedTagId) {
         throw new TransactionSuggestionRouterError({
            error: transactionSuggestionRouterErrors.BAD_REQUEST(),
            message: "Nenhuma sugestão de centro de custo disponível.",
         });
      }
      const result = await Result.tryPromise({
         try: () =>
            context.db.transaction(async (tx) =>
               tx
                  .update(transactions)
                  .set({
                     tagId: current.suggestedTagId,
                     suggestedTagId: null,
                     updatedAt: dayjs().toDate(),
                  })
                  .where(eq(transactions.id, input.id)),
            ),
         catch: () =>
            new TransactionSuggestionRouterError({
               error: transactionSuggestionRouterErrors.INTERNAL(),
               message: "Falha ao atualizar centro de custo do lançamento.",
            }),
      });
      if (Result.isError(result)) throw result.error;
      return { ok: true };
   });

export const dismissSuggestedTag = protectedProcedure
   .input(idSchema)
   .use(requireTransaction, (input) => input.id)
   .handler(async ({ context, input }) => {
      const result = await Result.tryPromise({
         try: () =>
            context.db.transaction(async (tx) =>
               tx
                  .update(transactions)
                  .set({ suggestedTagId: null, updatedAt: dayjs().toDate() })
                  .where(eq(transactions.id, input.id)),
            ),
         catch: () =>
            new TransactionSuggestionRouterError({
               error: transactionSuggestionRouterErrors.INTERNAL(),
               message: "Falha ao descartar sugestão.",
            }),
      });
      if (Result.isError(result)) throw result.error;
      return { ok: true };
   });
