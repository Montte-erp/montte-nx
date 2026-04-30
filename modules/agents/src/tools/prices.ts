import { toolDefinition } from "@tanstack/ai";
import { and, eq } from "drizzle-orm";
import { fromPromise } from "neverthrow";
import { z } from "zod";
import { servicePrices } from "@core/database/schemas/services";
import {
   createPriceSchema,
   updatePriceSchema,
} from "@modules/billing/contracts/services";
import type { ToolDeps } from "@modules/agents/tools/types";

const idInput = z.object({
   id: z.string().uuid().describe("UUID do preço."),
});

const createPriceForServiceInput = z
   .object({
      serviceId: z
         .string()
         .uuid()
         .describe("UUID do serviço dono do novo preço."),
   })
   .merge(createPriceSchema);

const updatePriceInput = z
   .object({
      id: z.string().uuid().describe("UUID do preço a atualizar."),
   })
   .merge(updatePriceSchema);

export function buildPricesTools(deps: ToolDeps) {
   const { db, teamId } = deps;

   const createPriceForServiceTool = toolDefinition({
      name: "services_create_price",
      description:
         "Cria um preço para um serviço já existente. Para serviço novo prefira services_setup.",
      inputSchema: createPriceForServiceInput,
      needsApproval: true,
      lazy: true,
   }).server(async ({ serviceId, ...priceData }) => {
      const ownerResult = await fromPromise(
         db.query.services.findFirst({
            columns: { id: true },
            where: (f, { and: a, eq: e }) =>
               a(e(f.id, serviceId), e(f.teamId, teamId)),
         }),
         () => "Falha ao verificar serviço.",
      );
      if (ownerResult.isErr())
         return { ok: false as const, error: ownerResult.error };
      if (!ownerResult.value)
         return { ok: false as const, error: "Serviço não encontrado." };

      const result = await fromPromise(
         db.transaction(async (tx) =>
            tx
               .insert(servicePrices)
               .values({ ...priceData, teamId, serviceId })
               .returning(),
         ),
         () => "Falha ao criar preço.",
      );
      if (result.isErr()) return { ok: false as const, error: result.error };
      const [row] = result.value;
      if (!row) return { ok: false as const, error: "Falha ao criar preço." };
      return {
         ok: true as const,
         price: {
            id: row.id,
            name: row.name,
            basePrice: row.basePrice,
            interval: row.interval,
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
         db.transaction(async (tx) =>
            tx
               .update(servicePrices)
               .set(data)
               .where(
                  and(
                     eq(servicePrices.id, id),
                     eq(servicePrices.teamId, teamId),
                  ),
               )
               .returning(),
         ),
         () => "Falha ao atualizar preço.",
      );
      if (result.isErr()) return { ok: false as const, error: result.error };
      const [row] = result.value;
      if (!row) return { ok: false as const, error: "Preço não encontrado." };
      return {
         ok: true as const,
         price: {
            id: row.id,
            name: row.name,
            basePrice: row.basePrice,
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
         () => "Falha ao remover preço.",
      );
      if (result.isErr()) return { ok: false as const, error: result.error };
      if (result.value.length === 0)
         return { ok: false as const, error: "Preço não encontrado." };
      return { ok: true as const, deleted: result.value[0]!.id };
   });

   return [createPriceForServiceTool, updatePriceTool, deletePriceTool];
}
