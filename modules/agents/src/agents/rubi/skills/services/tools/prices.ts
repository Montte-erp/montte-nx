import { toolDefinition } from "@tanstack/ai";
import { and, eq } from "drizzle-orm";
import { fromPromise } from "neverthrow";
import { z } from "zod";
import { services, servicePrices } from "@core/database/schemas/services";
import {
   createPriceSchema,
   updatePriceSchema,
} from "@modules/billing/contracts/services";
import type { SkillDeps } from "../../types";

const idInput = z.object({ id: z.string().uuid() });

const createPriceForServiceInput = z
   .object({ serviceId: z.string().uuid() })
   .merge(createPriceSchema);

const updatePriceInput = z
   .object({ id: z.string().uuid() })
   .merge(updatePriceSchema);

function errMessage(e: unknown) {
   return e instanceof Error ? e.message : String(e);
}

export function buildPricesTools(deps: SkillDeps) {
   const { db, teamId } = deps;

   const createPriceForServiceTool = toolDefinition({
      name: "services_create_price",
      description:
         "Cria um preço para um serviço já existente. Para serviço novo prefira services_setup.",
      inputSchema: createPriceForServiceInput,
      needsApproval: true,
      lazy: true,
   }).server(async ({ serviceId, ...priceData }) => {
      const result = await fromPromise(
         db.transaction(async (tx) => {
            const owner = await tx
               .select({ id: services.id })
               .from(services)
               .where(
                  and(eq(services.id, serviceId), eq(services.teamId, teamId)),
               )
               .limit(1);
            if (owner.length === 0) throw new Error("Serviço não encontrado.");
            const [row] = await tx
               .insert(servicePrices)
               .values({ ...priceData, teamId, serviceId })
               .returning();
            if (!row) throw new Error("Falha ao criar preço.");
            return row;
         }),
         errMessage,
      );
      if (result.isErr()) return { ok: false as const, error: result.error };
      return {
         ok: true as const,
         price: {
            id: result.value.id,
            name: result.value.name,
            basePrice: result.value.basePrice,
            interval: result.value.interval,
         },
      };
   });

   const updatePriceTool = toolDefinition({
      name: "prices_update",
      description: "Atualiza um preço (servicePrices) existente.",
      inputSchema: updatePriceInput,
      needsApproval: true,
      lazy: true,
   }).server(async ({ id, ...data }) => {
      const result = await fromPromise(
         db.transaction(async (tx) => {
            const [row] = await tx
               .update(servicePrices)
               .set(data)
               .where(
                  and(
                     eq(servicePrices.id, id),
                     eq(servicePrices.teamId, teamId),
                  ),
               )
               .returning();
            if (!row) throw new Error("Preço não encontrado.");
            return row;
         }),
         errMessage,
      );
      if (result.isErr()) return { ok: false as const, error: result.error };
      return {
         ok: true as const,
         price: {
            id: result.value.id,
            name: result.value.name,
            basePrice: result.value.basePrice,
         },
      };
   });

   const deletePriceTool = toolDefinition({
      name: "prices_delete",
      description: "Remove um preço.",
      inputSchema: idInput,
      needsApproval: true,
      lazy: true,
   }).server(async ({ id }) => {
      const result = await fromPromise(
         db.transaction(async (tx) =>
            tx
               .delete(servicePrices)
               .where(
                  and(
                     eq(servicePrices.id, id),
                     eq(servicePrices.teamId, teamId),
                  ),
               )
               .returning({ id: servicePrices.id }),
         ),
         errMessage,
      );
      if (result.isErr()) return { ok: false as const, error: result.error };
      if (result.value.length === 0)
         return { ok: false as const, error: "Preço não encontrado." };
      return { ok: true as const, deleted: result.value[0]!.id };
   });

   return [createPriceForServiceTool, updatePriceTool, deletePriceTool];
}
