import { toolDefinition } from "@tanstack/ai";
import { z } from "zod";
import {
   createServiceSchema,
   updateServiceSchema,
} from "@core/database/schemas/services";
import type { ToolDeps } from "@modules/agents/tools/types";

const idInput = z.object({ id: z.string().uuid() });
const updateServiceInput = idInput.merge(updateServiceSchema);
const setActiveInput = z.object({
   ids: z.array(z.string().uuid()).min(1),
   isActive: z.boolean(),
});
const bulkCreateInput = z.object({
   items: z.array(createServiceSchema).min(1),
});
const attachBenefitInput = z.object({
   serviceId: z.string().uuid(),
   benefitId: z.string().uuid(),
});
const listInput = z.object({
   search: z.string().optional(),
   isActive: z.boolean().optional(),
});

export function buildServicesTools({ orpcClient }: ToolDeps) {
   return [
      toolDefinition({
         name: "services_list",
         description:
            "Lista os serviços do catálogo da equipe. Use para encontrar serviços existentes antes de criar duplicados.",
         inputSchema: listInput,
         lazy: true,
      }).server((input) => orpcClient.services.getAll(input)),

      toolDefinition({
         name: "services_get",
         description: "Retorna um serviço com preços e benefícios anexados.",
         inputSchema: idInput,
         lazy: true,
      }).server(async ({ id }) => {
         const [service, prices, benefits] = await Promise.all([
            orpcClient.services.getById({ id }),
            orpcClient.prices.list({ serviceId: id }),
            orpcClient.benefits.getServiceBenefits({ serviceId: id }),
         ]);
         return { service, prices, benefits };
      }),

      toolDefinition({
         name: "services_create",
         description:
            "Cria um serviço sem preço/medidor/benefício. Use services_setup quando o serviço precisar de preço ou benefícios — evita múltiplas aprovações.",
         inputSchema: createServiceSchema,
         needsApproval: true,
         lazy: true,
      }).server((input) => orpcClient.services.create(input)),

      toolDefinition({
         name: "services_update",
         description: "Atualiza um serviço existente.",
         inputSchema: updateServiceInput,
         needsApproval: true,
         lazy: true,
      }).server((input) => orpcClient.services.update(input)),

      toolDefinition({
         name: "services_set_active",
         description:
            "Ativa ou arquiva múltiplos serviços de uma vez. Use isActive=false para arquivar.",
         inputSchema: setActiveInput,
         needsApproval: true,
         lazy: true,
      }).server((input) => orpcClient.services.bulkSetActive(input)),

      toolDefinition({
         name: "services_bulk_create",
         description:
            "Cria múltiplos serviços (catálogo inicial) — sem preços/medidores/benefícios. Use só quando importar lista de nomes; para configuração rica use services_setup por serviço.",
         inputSchema: bulkCreateInput,
         needsApproval: true,
         lazy: true,
      }).server((input) => orpcClient.services.bulkCreate(input)),

      toolDefinition({
         name: "services_attach_benefit",
         description:
            "Anexa um benefício existente a um serviço já existente. Para criar benefício junto com serviço prefira services_setup.",
         inputSchema: attachBenefitInput,
         needsApproval: true,
         lazy: true,
      }).server((input) => orpcClient.benefits.attachBenefit(input)),
   ];
}
