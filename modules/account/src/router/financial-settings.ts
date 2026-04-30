import dayjs from "dayjs";
import { fromPromise } from "neverthrow";
import {
   financialConfig,
   financialConfigInsertSchema,
} from "@core/database/schemas/settings-financial";
import { WebAppError } from "@core/logging/errors";
import { protectedProcedure } from "@core/orpc/server";

export const getSettings = protectedProcedure.handler(async ({ context }) => {
   const result = await fromPromise(
      context.db.query.financialConfig.findFirst({
         where: (f, { eq }) => eq(f.teamId, context.teamId),
      }),
      () => WebAppError.internal("Falha ao buscar configurações financeiras."),
   );
   if (result.isErr()) throw result.error;
   return result.value ?? null;
});

export const upsertSettings = protectedProcedure
   .input(financialConfigInsertSchema)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
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
         () =>
            WebAppError.internal("Falha ao salvar configurações financeiras."),
      );
      if (result.isErr()) throw result.error;
      const [row] = result.value;
      if (!row)
         throw WebAppError.internal(
            "Falha ao salvar configurações financeiras.",
         );
      return row;
   });
