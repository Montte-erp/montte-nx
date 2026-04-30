import { toolDefinition } from "@tanstack/ai";
import { z } from "zod";
import {
   createPriceSchema,
   updatePriceSchema,
} from "@core/database/schemas/services";
import type { ToolDeps } from "@modules/agents/tools/types";

const idInput = z.object({ id: z.string().uuid() });
const createInput = z
   .object({ serviceId: z.string().uuid() })
   .merge(createPriceSchema);
const updateInput = idInput.merge(updatePriceSchema);

export function buildPricesTools({ orpcClient }: ToolDeps) {
   return [
      toolDefinition({
         name: "services_create_price",
         description:
            "Cria um preço para um serviço já existente. Para serviço novo prefira services_setup.",
         inputSchema: createInput,
         needsApproval: true,
         lazy: true,
      }).server((input) => orpcClient.prices.create(input)),

      toolDefinition({
         name: "prices_update",
         description: "Atualiza um preço (servicePrices) existente.",
         inputSchema: updateInput,
         needsApproval: true,
         lazy: true,
      }).server((input) => orpcClient.prices.update(input)),

      toolDefinition({
         name: "prices_delete",
         description: "Remove um preço.",
         inputSchema: idInput,
         needsApproval: true,
         lazy: true,
      }).server((input) => orpcClient.prices.remove(input)),
   ];
}
