import { eq } from "drizzle-orm";
import { fromPromise } from "neverthrow";
import { meters } from "@core/database/schemas/meters";
import { WebAppError } from "@core/logging/errors";
import { protectedProcedure } from "@core/orpc/server";
import {
   createMeterSchema,
   idInputSchema,
   updateMeterInputSchema,
} from "../contracts/services";
import { requireMeter } from "./middlewares";

export const createMeter = protectedProcedure
   .input(createMeterSchema)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            const [row] = await tx
               .insert(meters)
               .values({ ...input, teamId: context.teamId })
               .returning();
            return row;
         }),
         () => WebAppError.internal("Falha ao criar medidor."),
      );
      if (result.isErr()) throw result.error;
      if (!result.value)
         throw WebAppError.internal("Falha ao criar medidor: insert vazio.");
      return result.value;
   });

export const getMeters = protectedProcedure.handler(async ({ context }) => {
   const result = await fromPromise(
      context.db.query.meters.findMany({
         where: (f, { eq }) => eq(f.teamId, context.teamId),
         orderBy: (f, { asc }) => [asc(f.name)],
      }),
      () => WebAppError.internal("Falha ao listar medidores."),
   );
   if (result.isErr()) throw result.error;
   return result.value;
});

export const getMeterById = protectedProcedure
   .input(idInputSchema)
   .use(requireMeter, (input) => input.id)
   .handler(({ context }) => context.meter);

export const updateMeterById = protectedProcedure
   .input(updateMeterInputSchema)
   .use(requireMeter, (input) => input.id)
   .handler(async ({ context, input }) => {
      const { id, ...data } = input;
      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            const [row] = await tx
               .update(meters)
               .set(data)
               .where(eq(meters.id, id))
               .returning();
            return row;
         }),
         () => WebAppError.internal("Falha ao atualizar medidor."),
      );
      if (result.isErr()) throw result.error;
      if (!result.value)
         throw WebAppError.internal(
            "Falha ao atualizar medidor: update vazio.",
         );
      return result.value;
   });

export const removeMeter = protectedProcedure
   .input(idInputSchema)
   .use(requireMeter, (input) => input.id)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            await tx.delete(meters).where(eq(meters.id, input.id));
         }),
         () => WebAppError.internal("Falha ao excluir medidor."),
      );
      if (result.isErr()) throw result.error;
      return { success: true as const };
   });
