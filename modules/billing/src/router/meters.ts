import { and, asc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { fromPromise } from "neverthrow";
import { meters } from "@core/database/schemas/meters";
import { servicePrices, services } from "@core/database/schemas/services";
import { benefits } from "@core/database/schemas/benefits";
import { coupons } from "@core/database/schemas/coupons";
import { WebAppError } from "@core/logging/errors";
import { protectedProcedure } from "@core/orpc/server";
import {
   bulkSetActiveInputSchema,
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

      const rowsResult = await fromPromise(
         context.db
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
            .orderBy(asc(meters.name)),
         () => WebAppError.internal("Falha ao listar medidores."),
      );
      if (rowsResult.isErr()) throw rowsResult.error;

      const filtered = input?.onlyInUse
         ? rowsResult.value.filter((r) => r.usedInPrices + r.usedInBenefits > 0)
         : rowsResult.value;
      return filtered.map((r) => ({
         ...r,
         usedIn: r.usedInPrices + r.usedInBenefits,
      }));
   });

export const getMeterById = protectedProcedure
   .input(idInputSchema)
   .use(requireMeter, (input) => input.id)
   .handler(({ context }) => context.meter);

export const getMeterUsage = protectedProcedure
   .input(idInputSchema)
   .use(requireMeter, (input) => input.id)
   .handler(async ({ context, input }) => {
      const pricesPromise = context.db
         .select({
            priceId: servicePrices.id,
            priceName: servicePrices.name,
            basePrice: servicePrices.basePrice,
            interval: servicePrices.interval,
            isActive: servicePrices.isActive,
            serviceId: services.id,
            serviceName: services.name,
         })
         .from(servicePrices)
         .innerJoin(services, eq(services.id, servicePrices.serviceId))
         .where(
            and(
               eq(servicePrices.teamId, context.teamId),
               eq(servicePrices.meterId, input.id),
            ),
         )
         .orderBy(asc(services.name), asc(servicePrices.name));

      const benefitsPromise = context.db
         .select({
            id: benefits.id,
            name: benefits.name,
            type: benefits.type,
            creditAmount: benefits.creditAmount,
            isActive: benefits.isActive,
         })
         .from(benefits)
         .where(
            and(
               eq(benefits.teamId, context.teamId),
               eq(benefits.meterId, input.id),
            ),
         )
         .orderBy(asc(benefits.name));

      const couponsPromise = context.db
         .select({
            id: coupons.id,
            code: coupons.code,
            direction: coupons.direction,
            trigger: coupons.trigger,
            type: coupons.type,
            amount: coupons.amount,
            scope: coupons.scope,
            isActive: coupons.isActive,
         })
         .from(coupons)
         .where(
            and(
               eq(coupons.teamId, context.teamId),
               eq(coupons.meterId, input.id),
            ),
         )
         .orderBy(asc(coupons.code));

      const result = await fromPromise(
         Promise.all([pricesPromise, benefitsPromise, couponsPromise]),
         () => WebAppError.internal("Falha ao carregar uso do medidor."),
      );
      if (result.isErr()) throw result.error;
      const [prices, benefitsRows, couponsRows] = result.value;
      return { prices, benefits: benefitsRows, coupons: couponsRows };
   });

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

export const bulkSetActive = protectedProcedure
   .input(bulkSetActiveInputSchema)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.transaction(async (tx) =>
            tx
               .update(meters)
               .set({ isActive: input.isActive })
               .where(
                  and(
                     inArray(meters.id, input.ids),
                     eq(meters.teamId, context.teamId),
                  ),
               )
               .returning({ id: meters.id }),
         ),
         () => WebAppError.internal("Falha ao atualizar medidores."),
      );
      if (result.isErr()) throw result.error;
      return { updated: result.value.length };
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
