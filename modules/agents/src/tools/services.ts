import { toolDefinition } from "@tanstack/ai";
import { z } from "zod";
import {
   bulkSetActiveInputSchema,
   idInputSchema,
   setupInputSchema,
   updateServiceInputSchema,
} from "@modules/billing/router/services";
import type { AgentToolClient } from "@modules/agents/orpc-tool-router";

interface ServicesToolsDeps {
   orpcClient: AgentToolClient;
}

const catalogSearchInputSchema = z.object({
   kind: z
      .enum(["services", "meters", "benefits", "coupons"])
      .describe("Tipo de recurso do catálogo que deve ser consultado."),
   search: z
      .string()
      .min(1)
      .optional()
      .describe("Filtro textual opcional por nome/código."),
   isActive: z
      .boolean()
      .optional()
      .describe("Filtra recursos ativos ou arquivados quando aplicável."),
});

export function buildServicesTools({ orpcClient }: ServicesToolsDeps) {
   return [
      toolDefinition({
         name: "catalog_search",
         description:
            "Consulta o catálogo comercial. Use kind=services/meters/benefits/coupons para listar recursos antes de configurar ou alterar serviços.",
         inputSchema: catalogSearchInputSchema,
         lazy: true,
      }).server(async (input) => {
         if (input.kind === "services") {
            const items = await orpcClient.services.getAll({
               search: input.search,
               isActive: input.isActive,
            });
            return { kind: input.kind, count: items.length, items };
         }

         if (input.kind === "meters") {
            const rows = await orpcClient.meters.getMeters({
               search: input.search,
            });
            const items =
               input.isActive === undefined
                  ? rows
                  : rows.filter((item) => item.isActive === input.isActive);
            return { kind: input.kind, count: items.length, items };
         }

         if (input.kind === "benefits") {
            const rows = await orpcClient.benefits.getBenefits({
               search: input.search,
            });
            const items =
               input.isActive === undefined
                  ? rows
                  : rows.filter((item) => item.isActive === input.isActive);
            return { kind: input.kind, count: items.length, items };
         }

         const rows = await orpcClient.coupons.list();
         const activeItems =
            input.isActive === undefined
               ? rows
               : rows.filter((item) => item.isActive === input.isActive);
         if (input.search === undefined) {
            return {
               kind: input.kind,
               count: activeItems.length,
               items: activeItems,
            };
         }

         const search = input.search.toLowerCase();
         const items = activeItems.filter((item) =>
            item.code.toLowerCase().includes(search),
         );
         return { kind: input.kind, count: items.length, items };
      }),

      toolDefinition({
         name: "service_details",
         description:
            "Retorna um serviço com seus preços e benefícios anexados. Use quando o usuário pedir detalhes ou antes de alterar um serviço existente.",
         inputSchema: idInputSchema,
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
         name: "service_setup",
         description:
            "Configura um serviço completo em uma única aprovação: cria o serviço, cria ou anexa medidor, cria preços e cria ou anexa benefícios. Prefira este tool para novos serviços.",
         inputSchema: setupInputSchema,
         needsApproval: true,
         lazy: true,
      }).server((input) => orpcClient.services.setup(input)),

      toolDefinition({
         name: "service_update",
         description:
            "Atualiza os campos básicos de um serviço existente. Para criar serviço novo, use service_setup.",
         inputSchema: updateServiceInputSchema,
         needsApproval: true,
         lazy: true,
      }).server(async (input) => {
         const service = await orpcClient.services.update(input);
         return { service };
      }),

      toolDefinition({
         name: "services_set_active",
         description:
            "Ativa ou arquiva serviços em lote. Use isActive=false para arquivar.",
         inputSchema: bulkSetActiveInputSchema,
         needsApproval: true,
         lazy: true,
      }).server(async (input) => {
         const result = await orpcClient.services.bulkSetActive(input);
         return {
            count: result.updated,
            isActive: input.isActive,
            services: result.services,
         };
      }),
   ];
}
