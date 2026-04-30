import dayjs from "dayjs";
import { fromPromise } from "neverthrow";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { agentSettings } from "@core/database/schemas/agents";
import { WebAppError } from "@core/logging/errors";
import { protectedProcedure } from "@core/orpc/server";

const upsertInput = createInsertSchema(agentSettings)
   .omit({ teamId: true, createdAt: true, updatedAt: true })
   .extend({ modelId: z.string().startsWith("openrouter/").optional() })
   .partial();

export const getSettings = protectedProcedure.handler(async ({ context }) => {
   const result = await fromPromise(
      context.db.query.agentSettings.findFirst({
         where: (f, { eq }) => eq(f.teamId, context.teamId),
      }),
      () => WebAppError.internal("Falha ao buscar configurações."),
   );
   if (result.isErr()) throw result.error;
   return result.value ?? null;
});

export const upsertSettings = protectedProcedure
   .input(upsertInput)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.transaction(async (tx) =>
            tx
               .insert(agentSettings)
               .values({ teamId: context.teamId, ...input })
               .onConflictDoUpdate({
                  target: agentSettings.teamId,
                  set: { ...input, updatedAt: dayjs().toDate() },
               })
               .returning()
               .then((rows) => rows[0]),
         ),
         () => WebAppError.internal("Falha ao salvar configurações."),
      );
      if (result.isErr()) throw result.error;
      if (!result.value)
         throw WebAppError.internal(
            "Falha ao salvar configurações: upsert vazio.",
         );
      return result.value;
   });
