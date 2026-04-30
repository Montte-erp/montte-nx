import { toolDefinition } from "@tanstack/ai";
import { z } from "zod";
import {
   createMeterSchema,
   updateMeterSchema,
} from "@core/database/schemas/meters";
import type { ToolDeps } from "@modules/agents/tools/types";

const listInput = z.object({ search: z.string().optional() });
const updateInput = z
   .object({ id: z.string().uuid() })
   .merge(updateMeterSchema);

export function buildMetersTools({ orpcClient }: ToolDeps) {
   return [
      toolDefinition({
         name: "meters_list",
         description:
            "Lista medidores (meters). Medidores rastreiam uso (eventos) e alimentam preços por consumo e benefícios com créditos.",
         inputSchema: listInput,
         lazy: true,
      }).server((input) => orpcClient.meters.getMeters(input)),

      toolDefinition({
         name: "meters_create",
         description:
            "Cria um medidor avulso (sem vincular a serviço). Para serviço novo com preço por consumo prefira services_setup.",
         inputSchema: createMeterSchema,
         needsApproval: true,
         lazy: true,
      }).server((input) => orpcClient.meters.createMeter(input)),

      toolDefinition({
         name: "meters_update",
         description: "Atualiza um medidor.",
         inputSchema: updateInput,
         needsApproval: true,
         lazy: true,
      }).server((input) => orpcClient.meters.updateMeterById(input)),
   ];
}
