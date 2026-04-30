import dayjs from "dayjs";
import { eq } from "drizzle-orm";
import { fromPromise } from "neverthrow";
import { z } from "zod";
import { transactions } from "@core/database/schemas/transactions";
import { WebAppError } from "@core/logging/errors";
import { protectedProcedure } from "@core/orpc/server";
import { requireTransaction } from "@modules/finance/router/middlewares";

const idSchema = z.object({ id: z.string().uuid() });

export const acceptSuggestedCategory = protectedProcedure
   .input(idSchema)
   .use(requireTransaction, (input) => input.id)
   .handler(async ({ context, input }) => {
      const tx = context.transaction;
      if (!tx.suggestedCategoryId) {
         throw WebAppError.badRequest(
            "Nenhuma sugestão de categoria disponível.",
         );
      }
      const result = await fromPromise(
         context.db
            .update(transactions)
            .set({
               categoryId: tx.suggestedCategoryId,
               suggestedCategoryId: null,
               updatedAt: dayjs().toDate(),
            })
            .where(eq(transactions.id, input.id)),
         () =>
            WebAppError.internal("Falha ao atualizar categoria do lançamento."),
      );
      if (result.isErr()) throw result.error;
      return { ok: true };
   });

export const dismissSuggestedCategory = protectedProcedure
   .input(idSchema)
   .use(requireTransaction, (input) => input.id)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db
            .update(transactions)
            .set({ suggestedCategoryId: null, updatedAt: dayjs().toDate() })
            .where(eq(transactions.id, input.id)),
         () => WebAppError.internal("Falha ao descartar sugestão."),
      );
      if (result.isErr()) throw result.error;
      return { ok: true };
   });

export const acceptSuggestedTag = protectedProcedure
   .input(idSchema)
   .use(requireTransaction, (input) => input.id)
   .handler(async ({ context, input }) => {
      const tx = context.transaction;
      if (!tx.suggestedTagId) {
         throw WebAppError.badRequest(
            "Nenhuma sugestão de centro de custo disponível.",
         );
      }
      const result = await fromPromise(
         context.db
            .update(transactions)
            .set({
               tagId: tx.suggestedTagId,
               suggestedTagId: null,
               updatedAt: dayjs().toDate(),
            })
            .where(eq(transactions.id, input.id)),
         () =>
            WebAppError.internal(
               "Falha ao atualizar centro de custo do lançamento.",
            ),
      );
      if (result.isErr()) throw result.error;
      return { ok: true };
   });

export const dismissSuggestedTag = protectedProcedure
   .input(idSchema)
   .use(requireTransaction, (input) => input.id)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db
            .update(transactions)
            .set({ suggestedTagId: null, updatedAt: dayjs().toDate() })
            .where(eq(transactions.id, input.id)),
         () => WebAppError.internal("Falha ao descartar sugestão."),
      );
      if (result.isErr()) throw result.error;
      return { ok: true };
   });
