import { eq } from "drizzle-orm";
import { fromPromise } from "neverthrow";
import type { DatabaseInstance } from "@core/database/client";
import { benefits, serviceBenefits } from "@core/database/schemas/benefits";
import { servicePrices } from "@core/database/schemas/services";
import { WebAppError } from "@core/logging/errors";
import { protectedProcedure } from "@core/orpc/server";
import {
   createPriceForServiceInputSchema,
   idInputSchema,
   serviceIdInputSchema,
   updatePriceInputSchema,
} from "@modules/billing/contracts/services";
import {
   computeEffectiveCost,
   formatCostBRL,
   isBelowFloor,
   moneyAtCostScale,
} from "@modules/billing/services/cost";
import {
   requireService,
   requireServicePrice,
} from "@modules/billing/router/middlewares";

type PriceType = "flat" | "per_unit" | "metered";

async function loadCostInputs(
   db: DatabaseInstance,
   teamId: string,
   serviceId: string,
   meterId: string | null | undefined,
   priceType: PriceType | undefined,
) {
   const service = await db.query.services.findFirst({
      where: (f, { eq: e, and: a }) =>
         a(e(f.id, serviceId), e(f.teamId, teamId)),
      columns: { id: true, costPrice: true },
   });
   if (!service) throw WebAppError.notFound("Serviço não encontrado.");

   const attachedBenefits = await db
      .select({
         unitCost: benefits.unitCost,
         creditAmount: benefits.creditAmount,
      })
      .from(serviceBenefits)
      .innerJoin(benefits, eq(serviceBenefits.benefitId, benefits.id))
      .where(eq(serviceBenefits.serviceId, serviceId));

   let meter: { unitCost: string } | null = null;
   if (priceType === "metered" && meterId) {
      const m = await db.query.meters.findFirst({
         where: (f, { eq: e, and: a }) =>
            a(e(f.id, meterId), e(f.teamId, teamId)),
         columns: { unitCost: true },
      });
      if (m) meter = m;
   }

   return { service, attachedBenefits, meter };
}

async function assertFloor(args: {
   db: DatabaseInstance;
   teamId: string;
   serviceId: string;
   meterId: string | null | undefined;
   type: PriceType | undefined;
   minPrice: string | null | undefined;
}) {
   if (!args.minPrice) return;
   const { service, attachedBenefits, meter } = await loadCostInputs(
      args.db,
      args.teamId,
      args.serviceId,
      args.meterId,
      args.type,
   );
   const effective = computeEffectiveCost({
      serviceCostPrice: service.costPrice,
      benefits: attachedBenefits.map((b) => ({
         unitCost: b.unitCost,
         creditAmount: b.creditAmount,
      })),
      price: args.type
         ? { type: args.type, meterId: args.meterId ?? null }
         : undefined,
      meter,
   });
   if (isBelowFloor(args.minPrice, effective)) {
      throw WebAppError.badRequest(
         `Piso ${formatCostBRL(moneyAtCostScale(args.minPrice))} está abaixo do custo efetivo ${formatCostBRL(effective)}.`,
      );
   }
}

export const list = protectedProcedure
   .input(serviceIdInputSchema)
   .use(requireService, (input) => input.serviceId)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.query.servicePrices.findMany({
            where: (f, { eq }) => eq(f.serviceId, input.serviceId),
            orderBy: (f, { asc }) => [asc(f.name)],
         }),
         () => WebAppError.internal("Falha ao listar preços."),
      );
      if (result.isErr()) throw result.error;
      return result.value;
   });

export const create = protectedProcedure
   .input(createPriceForServiceInputSchema)
   .use(requireService, (input) => input.serviceId)
   .handler(async ({ context, input }) => {
      const { serviceId, ...priceData } = input;
      if (input.type === "metered" && !input.meterId)
         throw WebAppError.badRequest(
            "meterId é obrigatório para preços do tipo 'metered'.",
         );
      if (input.type === "metered" && Number(input.basePrice) !== 0)
         throw WebAppError.badRequest(
            "basePrice deve ser 0 para preços do tipo 'metered'.",
         );
      await assertFloor({
         db: context.db,
         teamId: context.teamId,
         serviceId,
         meterId: input.meterId,
         type: input.type,
         minPrice: input.minPrice,
      });
      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            const [row] = await tx
               .insert(servicePrices)
               .values({ ...priceData, teamId: context.teamId, serviceId })
               .returning();
            return row;
         }),
         () => WebAppError.internal("Falha ao criar preço."),
      );
      if (result.isErr()) throw result.error;
      if (!result.value)
         throw WebAppError.internal("Falha ao criar preço: insert vazio.");
      return result.value;
   });

export const update = protectedProcedure
   .input(updatePriceInputSchema)
   .use(requireServicePrice, (input) => input.id)
   .handler(async ({ context, input }) => {
      const { id, ...data } = input;
      if (
         input.type === "metered" &&
         (input.meterId === null || input.meterId === undefined)
      )
         throw WebAppError.badRequest(
            "meterId é obrigatório para preços do tipo 'metered'.",
         );
      if (input.minPrice !== undefined && input.minPrice !== null) {
         await assertFloor({
            db: context.db,
            teamId: context.teamId,
            serviceId: context.servicePrice.serviceId,
            meterId: input.meterId ?? context.servicePrice.meterId,
            type: input.type ?? context.servicePrice.type,
            minPrice: input.minPrice,
         });
      }
      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            const [row] = await tx
               .update(servicePrices)
               .set(data)
               .where(eq(servicePrices.id, id))
               .returning();
            return row;
         }),
         () => WebAppError.internal("Falha ao atualizar preço."),
      );
      if (result.isErr()) throw result.error;
      if (!result.value)
         throw WebAppError.internal("Falha ao atualizar preço: update vazio.");
      return result.value;
   });

export const remove = protectedProcedure
   .input(idInputSchema)
   .use(requireServicePrice, (input) => input.id)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            await tx
               .delete(servicePrices)
               .where(eq(servicePrices.id, input.id));
         }),
         () => WebAppError.internal("Falha ao excluir preço."),
      );
      if (result.isErr()) throw result.error;
      return { success: true as const };
   });
