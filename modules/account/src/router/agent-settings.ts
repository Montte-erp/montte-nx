import dayjs from "dayjs";
import { Result } from "better-result";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { agentSettings } from "@core/database/schemas/agents";
import { protectedProcedure } from "@core/orpc/server";
import { AccountError, accountErrors } from "@modules/account/router/errors";

const settingsOutput = z.object({
   modelId: z.string().default("openrouter/moonshotai/kimi-k2.5"),
   reasoningEffort: z.enum(["high", "xhigh"]).default("high"),
   language: z.string().default("pt-BR"),
   tone: z.string().default("formal"),
   dataSourceTransactions: z.boolean().default(true),
});

const upsertInput = createInsertSchema(agentSettings)
   .omit({
      teamId: true,
      dataSourceContacts: true,
      dataSourceServices: true,
      createdAt: true,
      updatedAt: true,
   })
   .extend({ modelId: z.string().startsWith("openrouter/").optional() })
   .partial();

export const getSettings = protectedProcedure.handler(async ({ context }) => {
   const result = await Result.tryPromise({
      try: () =>
         context.db.query.agentSettings.findFirst({
            where: (f, { eq }) => eq(f.teamId, context.teamId),
         }),
      catch: () =>
         new AccountError({
            error: accountErrors.INTERNAL(),
            message: "Falha ao buscar configurações.",
            teamId: context.teamId,
         }),
   });
   if (result.isErr()) throw result.error;

   return settingsOutput.parse(result.value ?? {});
});

export const upsertSettings = protectedProcedure
   .input(upsertInput)
   .handler(async ({ context, input }) => {
      const result = await Result.tryPromise({
         try: () =>
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
         catch: () =>
            new AccountError({
               error: accountErrors.INTERNAL(),
               message: "Falha ao salvar configurações.",
               teamId: context.teamId,
            }),
      });
      if (result.isErr()) throw result.error;

      if (!result.value) {
         throw new AccountError({
            error: accountErrors.INTERNAL(),
            message: "Falha ao salvar configurações: upsert vazio.",
            teamId: context.teamId,
         });
      }

      return settingsOutput.parse(result.value);
   });
