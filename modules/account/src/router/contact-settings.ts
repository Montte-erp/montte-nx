import dayjs from "dayjs";
import { fromPromise } from "neverthrow";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { contactSettings } from "@core/database/schemas/contact-settings";
import { WebAppError } from "@core/logging/errors";
import { protectedProcedure } from "@core/orpc/server";

const upsertInput = createInsertSchema(contactSettings)
   .omit({ teamId: true, createdAt: true, updatedAt: true })
   .extend({ defaultContactType: z.enum(["pf", "pj"]) })
   .partial();

export const getSettings = protectedProcedure.handler(async ({ context }) => {
   const result = await fromPromise(
      context.db.query.contactSettings.findFirst({
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
         context.db
            .insert(contactSettings)
            .values({ teamId: context.teamId, ...input })
            .onConflictDoUpdate({
               target: contactSettings.teamId,
               set: { ...input, updatedAt: dayjs().toDate() },
            })
            .returning()
            .then((rows) => rows[0]),
         () => WebAppError.internal("Falha ao salvar configurações."),
      );
      if (result.isErr()) throw result.error;
      if (!result.value)
         throw WebAppError.internal(
            "Falha ao salvar configurações: upsert vazio.",
         );
      return result.value;
   });
