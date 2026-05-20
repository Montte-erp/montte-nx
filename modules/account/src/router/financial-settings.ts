import dayjs from "dayjs";
import { Result } from "better-result";
import {
   financialConfig,
   financialConfigInsertSchema,
} from "@core/database/schemas/settings-financial";
import { protectedProcedure } from "@core/orpc/server";
import { AccountError, accountErrors } from "@modules/account/router/errors";

export const getSettings = protectedProcedure.handler(async ({ context }) => {
   const result = await Result.tryPromise({
      try: () =>
         context.db.query.financialConfig.findFirst({
            where: (f, { eq }) => eq(f.teamId, context.teamId),
         }),
      catch: () =>
         new AccountError({
            error: accountErrors.INTERNAL(),
            message: "Falha ao buscar configurações financeiras.",
            teamId: context.teamId,
         }),
   });
   if (result.isErr()) throw result.error;
   return result.value ?? null;
});

export const upsertSettings = protectedProcedure
   .input(financialConfigInsertSchema)
   .handler(async ({ context, input }) => {
      const result = await Result.tryPromise({
         try: () =>
            context.db.transaction(async (tx) =>
               tx
                  .insert(financialConfig)
                  .values({ teamId: context.teamId, ...input })
                  .onConflictDoUpdate({
                     target: financialConfig.teamId,
                     set: { ...input, updatedAt: dayjs().toDate() },
                  })
                  .returning(),
            ),
         catch: () =>
            new AccountError({
               error: accountErrors.INTERNAL(),
               message: "Falha ao salvar configurações financeiras.",
               teamId: context.teamId,
            }),
      });
      if (result.isErr()) throw result.error;

      const [row] = result.value;
      if (!row) {
         throw new AccountError({
            error: accountErrors.INTERNAL(),
            message: "Falha ao salvar configurações financeiras.",
            teamId: context.teamId,
         });
      }

      return row;
   });
