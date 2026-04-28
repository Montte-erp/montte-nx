import { and, asc, count, eq, ilike, or, sql } from "drizzle-orm";
import { fromPromise } from "neverthrow";
import { benefits, serviceBenefits } from "@core/database/schemas/benefits";
import { WebAppError } from "@core/logging/errors";
import { protectedProcedure } from "@core/orpc/server";
import {
   createAndAttachBenefitInputSchema,
   createBenefitSchema,
   idInputSchema,
   listBenefitsInputSchema,
   serviceBenefitLinkSchema,
   serviceIdInputSchema,
   updateBenefitInputSchema,
} from "../contracts/services";
import { requireBenefit, requireService } from "./middlewares";

export const createBenefit = protectedProcedure
   .input(createBenefitSchema)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            const [row] = await tx
               .insert(benefits)
               .values({ ...input, teamId: context.teamId })
               .returning();
            return row;
         }),
         () => WebAppError.internal("Falha ao criar benefício."),
      );
      if (result.isErr()) throw result.error;
      if (!result.value)
         throw WebAppError.internal("Falha ao criar benefício: insert vazio.");
      return result.value;
   });

export const getBenefits = protectedProcedure
   .input(listBenefitsInputSchema)
   .handler(async ({ context, input }) => {
      const conditions = [eq(benefits.teamId, context.teamId)];
      if (input?.isActive !== undefined)
         conditions.push(eq(benefits.isActive, input.isActive));
      if (input?.type) conditions.push(eq(benefits.type, input.type));
      if (input?.search) {
         const q = `%${input.search}%`;
         const searchCond = or(
            ilike(benefits.name, q),
            ilike(benefits.description, q),
         );
         if (searchCond) conditions.push(searchCond);
      }
      const usedFilter = input?.onlyInUse
         ? sql`COUNT(${serviceBenefits.serviceId}) > 0`
         : undefined;
      const rows = await context.db
         .select({
            id: benefits.id,
            teamId: benefits.teamId,
            name: benefits.name,
            type: benefits.type,
            meterId: benefits.meterId,
            creditAmount: benefits.creditAmount,
            description: benefits.description,
            unitCost: benefits.unitCost,
            rollover: benefits.rollover,
            isActive: benefits.isActive,
            createdAt: benefits.createdAt,
            updatedAt: benefits.updatedAt,
            usedInServices: count(serviceBenefits.serviceId),
         })
         .from(benefits)
         .leftJoin(serviceBenefits, eq(benefits.id, serviceBenefits.benefitId))
         .where(and(...conditions))
         .groupBy(benefits.id)
         .having(usedFilter)
         .orderBy(asc(benefits.name));
      return rows;
   });

export const getBenefitById = protectedProcedure
   .input(idInputSchema)
   .use(requireBenefit, (input) => input.id)
   .handler(({ context }) => context.benefit);

export const updateBenefitById = protectedProcedure
   .input(updateBenefitInputSchema)
   .use(requireBenefit, (input) => input.id)
   .handler(async ({ context, input }) => {
      const { id, ...data } = input;
      const patch =
         data.type && data.type !== "credits"
            ? { ...data, creditAmount: null, meterId: null, rollover: false }
            : data;
      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            const [row] = await tx
               .update(benefits)
               .set(patch)
               .where(eq(benefits.id, id))
               .returning();
            return row;
         }),
         () => WebAppError.internal("Falha ao atualizar benefício."),
      );
      if (result.isErr()) throw result.error;
      if (!result.value)
         throw WebAppError.internal(
            "Falha ao atualizar benefício: update vazio.",
         );
      return result.value;
   });

export const removeBenefit = protectedProcedure
   .input(idInputSchema)
   .use(requireBenefit, (input) => input.id)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            await tx.delete(benefits).where(eq(benefits.id, input.id));
         }),
         () => WebAppError.internal("Falha ao excluir benefício."),
      );
      if (result.isErr()) throw result.error;
      return { success: true as const };
   });

export const attachBenefit = protectedProcedure
   .input(serviceBenefitLinkSchema)
   .use(requireService, (input) => input.serviceId)
   .use(requireBenefit, (input) => input.benefitId)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            await tx
               .insert(serviceBenefits)
               .values({
                  serviceId: input.serviceId,
                  benefitId: input.benefitId,
               })
               .onConflictDoNothing();
         }),
         () => WebAppError.internal("Falha ao associar benefício ao serviço."),
      );
      if (result.isErr()) throw result.error;
      return { success: true as const };
   });

export const detachBenefit = protectedProcedure
   .input(serviceBenefitLinkSchema)
   .use(requireService, (input) => input.serviceId)
   .use(requireBenefit, (input) => input.benefitId)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            await tx
               .delete(serviceBenefits)
               .where(
                  and(
                     eq(serviceBenefits.serviceId, input.serviceId),
                     eq(serviceBenefits.benefitId, input.benefitId),
                  ),
               );
         }),
         () => WebAppError.internal("Falha ao remover benefício do serviço."),
      );
      if (result.isErr()) throw result.error;
      return { success: true as const };
   });

export const createAndAttachBenefit = protectedProcedure
   .input(createAndAttachBenefitInputSchema)
   .use(requireService, (input) => input.serviceId)
   .handler(async ({ context, input }) => {
      const { serviceId, ...benefitData } = input;
      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            const [row] = await tx
               .insert(benefits)
               .values({ ...benefitData, teamId: context.teamId })
               .returning();
            if (!row) return null;
            await tx
               .insert(serviceBenefits)
               .values({ serviceId, benefitId: row.id })
               .onConflictDoNothing();
            return row;
         }),
         () => WebAppError.internal("Falha ao criar e vincular benefício."),
      );
      if (result.isErr()) throw result.error;
      if (!result.value)
         throw WebAppError.internal(
            "Falha ao criar e vincular benefício: insert vazio.",
         );
      return result.value;
   });

export const getServiceBenefits = protectedProcedure
   .input(serviceIdInputSchema)
   .use(requireService, (input) => input.serviceId)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.query.serviceBenefits.findMany({
            where: (f, { eq }) => eq(f.serviceId, input.serviceId),
            with: { benefit: true },
         }),
         () => WebAppError.internal("Falha ao listar benefícios do serviço."),
      );
      if (result.isErr()) throw result.error;
      return result.value.map((r) => r.benefit);
   });
