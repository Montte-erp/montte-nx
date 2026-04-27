import { eq } from "drizzle-orm";
import { fromPromise } from "neverthrow";
import { services, servicePrices } from "@core/database/schemas/services";
import { WebAppError } from "@core/logging/errors";
import { protectedProcedure } from "@core/orpc/server";
import {
   createServiceSchema,
   listServicesInputSchema,
   idInputSchema,
   serviceIdInputSchema,
   bulkCreateServicesInputSchema,
   createPriceForServiceInputSchema,
   updateServiceInputSchema,
   updatePriceInputSchema,
} from "../contracts/services";
import { requireService, requireServicePrice } from "./middlewares";

export const getAll = protectedProcedure
   .input(listServicesInputSchema)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.query.services.findMany({
            where: (f, { eq, and, or, ilike }) => {
               const conditions = [eq(f.teamId, context.teamId)];
               if (input?.search) {
                  const pattern = `%${input.search}%`;
                  const match = or(
                     ilike(f.name, pattern),
                     ilike(f.description, pattern),
                  );
                  if (match) conditions.push(match);
               }
               if (input?.categoryId)
                  conditions.push(eq(f.categoryId, input.categoryId));
               return and(...conditions);
            },
            with: { category: true, tag: true },
            orderBy: (f, { asc }) => [asc(f.name)],
         }),
         () => WebAppError.internal("Falha ao listar serviços."),
      );
      if (result.isErr()) throw result.error;
      return result.value;
   });

export const getById = protectedProcedure
   .input(idInputSchema)
   .use(requireService, (input) => input.id)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.query.services.findFirst({
            where: (f, { eq }) => eq(f.id, input.id),
            with: { category: true, tag: true },
         }),
         () => WebAppError.internal("Falha ao buscar serviço."),
      );
      if (result.isErr()) throw result.error;
      if (!result.value) throw WebAppError.notFound("Serviço não encontrado.");
      return result.value;
   });

export const create = protectedProcedure
   .input(createServiceSchema)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            const [row] = await tx
               .insert(services)
               .values({ ...input, teamId: context.teamId })
               .returning();
            return row;
         }),
         () => WebAppError.internal("Falha ao criar serviço."),
      );
      if (result.isErr()) throw result.error;
      if (!result.value)
         throw WebAppError.internal("Falha ao criar serviço: insert vazio.");
      return result.value;
   });

export const bulkCreate = protectedProcedure
   .input(bulkCreateServicesInputSchema)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.transaction(async (tx) =>
            tx
               .insert(services)
               .values(
                  input.items.map((item) => ({
                     ...item,
                     teamId: context.teamId,
                  })),
               )
               .returning(),
         ),
         () => WebAppError.internal("Falha ao importar serviços."),
      );
      if (result.isErr()) throw result.error;
      if (result.value.length === 0)
         throw WebAppError.internal("Falha ao importar os serviços.");
      return result.value;
   });

export const update = protectedProcedure
   .input(updateServiceInputSchema)
   .use(requireService, (input) => input.id)
   .handler(async ({ context, input }) => {
      const { id, ...data } = input;
      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            const [row] = await tx
               .update(services)
               .set(data)
               .where(eq(services.id, id))
               .returning();
            return row;
         }),
         () => WebAppError.internal("Falha ao atualizar serviço."),
      );
      if (result.isErr()) throw result.error;
      if (!result.value)
         throw WebAppError.internal(
            "Falha ao atualizar serviço: update vazio.",
         );
      return result.value;
   });

export const remove = protectedProcedure
   .input(idInputSchema)
   .use(requireService, (input) => input.id)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            await tx.delete(services).where(eq(services.id, input.id));
         }),
         () => WebAppError.internal("Falha ao excluir serviço."),
      );
      if (result.isErr()) throw result.error;
      return { success: true as const };
   });

export const exportAll = protectedProcedure.handler(async ({ context }) => {
   const result = await fromPromise(
      context.db.query.services.findMany({
         where: (f, { eq }) => eq(f.teamId, context.teamId),
         with: { category: true, tag: true },
         orderBy: (f, { asc }) => [asc(f.name)],
      }),
      () => WebAppError.internal("Falha ao listar serviços."),
   );
   if (result.isErr()) throw result.error;
   return result.value;
});

export const getVariants = protectedProcedure
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

export const createVariant = protectedProcedure
   .input(createPriceForServiceInputSchema)
   .use(requireService, (input) => input.serviceId)
   .handler(async ({ context, input }) => {
      const { serviceId, ...variantData } = input;
      if (input.type === "metered") {
         if (!input.meterId)
            throw WebAppError.badRequest(
               "meterId é obrigatório para preços do tipo 'metered'.",
            );
         if (Number(input.basePrice) !== 0)
            throw WebAppError.badRequest(
               "Preços do tipo 'metered' devem ter basePrice igual a '0'.",
            );
      }
      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            const [row] = await tx
               .insert(servicePrices)
               .values({ ...variantData, teamId: context.teamId, serviceId })
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

export const updateVariant = protectedProcedure
   .input(updatePriceInputSchema)
   .use(requireServicePrice, (input) => input.id)
   .handler(async ({ context, input }) => {
      const { id, ...data } = input;
      if (input.type === "metered") {
         if (input.meterId === null || input.meterId === undefined)
            throw WebAppError.badRequest(
               "meterId é obrigatório para preços do tipo 'metered'.",
            );
         if (input.basePrice !== undefined && Number(input.basePrice) !== 0)
            throw WebAppError.badRequest(
               "Preços do tipo 'metered' devem ter basePrice igual a '0'.",
            );
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

export const removeVariant = protectedProcedure
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
