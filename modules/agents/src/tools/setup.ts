import { toolDefinition } from "@tanstack/ai";
import { z } from "zod";
import { createBenefitSchema } from "@core/database/schemas/benefits";
import { createMeterSchema } from "@core/database/schemas/meters";
import {
   createPriceSchema,
   createServiceSchema,
} from "@core/database/schemas/services";
import type { ToolDeps } from "@modules/agents/tools/types";

const setupInput = z.object({
   service: createServiceSchema,
   meter: z
      .union([z.object({ id: z.string().uuid() }), createMeterSchema])
      .optional(),
   prices: z.array(createPriceSchema).optional().default([]),
   benefits: z
      .array(
         z.union([z.object({ id: z.string().uuid() }), createBenefitSchema]),
      )
      .optional()
      .default([]),
});

export function buildSetupTools({ orpcClient }: ToolDeps) {
   return [
      toolDefinition({
         name: "services_setup",
         description:
            "PREFIRA ESTE TOOL para montar serviço completo de uma vez: cria/anexa medidor, cria preços, cria/anexa benefícios — tudo em UMA aprovação. Use ele em vez de encadear services_create + meters_create + services_create_price + benefits_create + services_attach_benefit. Apenas use os tools atômicos para ajustes pontuais em catálogo já existente.",
         inputSchema: setupInput,
         needsApproval: true,
         lazy: true,
      }).server((input) => orpcClient.services.setup(input)),
   ];
}
