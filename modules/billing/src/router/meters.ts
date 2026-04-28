import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { fromPromise } from "neverthrow";
import { meters } from "@core/database/schemas/meters";
import { servicePrices } from "@core/database/schemas/services";
import { benefits } from "@core/database/schemas/benefits";
import { WebAppError } from "@core/logging/errors";
import { protectedProcedure } from "@core/orpc/server";
import {
   createMeterSchema,
   idInputSchema,
   listMetersInputSchema,
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

export const getMeters = protectedProcedure
   .input(listMetersInputSchema)
   .handler(async ({ context, input }) => {
      const conditions = [eq(meters.teamId, context.teamId)];
      if (input?.isActive !== undefined)
         conditions.push(eq(meters.isActive, input.isActive));
      if (input?.aggregation)
         conditions.push(eq(meters.aggregation, input.aggregation));
      if (input?.search) {
         const q = `%${input.search}%`;
         const searchCond = or(
            ilike(meters.name, q),
            ilike(meters.eventName, q),
         );
         if (searchCond) conditions.push(searchCond);
      }

      const usedInPrices = sql<number>`(
         SELECT COUNT(*)::int FROM ${servicePrices}
         WHERE ${servicePrices.meterId} = ${meters.id}
      )`;
      const usedInBenefits = sql<number>`(
         SELECT COUNT(*)::int FROM ${benefits}
         WHERE ${benefits.meterId} = ${meters.id}
      )`;

      const rows = await context.db
         .select({
            id: meters.id,
            teamId: meters.teamId,
            name: meters.name,
            eventName: meters.eventName,
            aggregation: meters.aggregation,
            aggregationProperty: meters.aggregationProperty,
            filters: meters.filters,
            unitCost: meters.unitCost,
            isActive: meters.isActive,
            createdAt: meters.createdAt,
            updatedAt: meters.updatedAt,
            usedInPrices,
            usedInBenefits,
         })
         .from(meters)
         .where(and(...conditions))
         .orderBy(asc(meters.name));

      const filtered = input?.onlyInUse
         ? rows.filter((r) => r.usedInPrices + r.usedInBenefits > 0)
         : rows;
      return filtered.map((r) => ({
         ...r,
         usedIn: r.usedInPrices + r.usedInBenefits,
      }));
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
      const patch =
         data.aggregation && data.aggregation === "count"
            ? { ...data, aggregationProperty: null }
            : data;
      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            const [row] = await tx
               .update(meters)
               .set(patch)
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
