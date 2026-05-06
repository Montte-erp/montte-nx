import { toolDefinition } from "@tanstack/ai";
import { z } from "zod";
import {
   createBenefitSchema,
   updateBenefitSchema,
} from "@core/database/schemas/benefits";
import {
   createCouponSchema,
   updateCouponSchema,
} from "@core/database/schemas/coupons";
import {
   createMeterSchema,
   updateMeterSchema,
} from "@core/database/schemas/meters";
import {
   createPriceSchema,
   updatePriceSchema,
} from "@core/database/schemas/services";
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

const resourceIdInputSchema = z.object({
   id: z.string().uuid().describe("ID do recurso."),
});

const bulkResourceSetActiveInputSchema = z.object({
   ids: z
      .array(z.string().uuid())
      .min(1)
      .describe("IDs dos recursos que serão alterados."),
   isActive: z.boolean().describe("true para ativar; false para arquivar."),
});

const createPriceForServiceInputSchema = z
   .object({
      serviceId: z.string().uuid().describe("ID do serviço."),
   })
   .merge(createPriceSchema);

const updatePriceInputSchema = resourceIdInputSchema.merge(updatePriceSchema);

const updateMeterInputSchema = resourceIdInputSchema.merge(updateMeterSchema);

const updateBenefitInputSchema =
   resourceIdInputSchema.merge(updateBenefitSchema);

const createAndAttachBenefitInputSchema = z
   .object({
      serviceId: z.string().uuid().describe("ID do serviço."),
   })
   .merge(createBenefitSchema);

const serviceBenefitLinkInputSchema = z.object({
   serviceId: z.string().uuid().describe("ID do serviço."),
   benefitId: z.string().uuid().describe("ID do benefício."),
});

const updateCouponInputSchema = resourceIdInputSchema.merge(updateCouponSchema);

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
         name: "meter_details",
         description:
            "Retorna um medidor e onde ele é usado em preços, benefícios e cupons.",
         inputSchema: resourceIdInputSchema,
         lazy: true,
      }).server(async ({ id }) => {
         const [meter, usage] = await Promise.all([
            orpcClient.meters.getMeterById({ id }),
            orpcClient.meters.getMeterUsage({ id }),
         ]);
         return { meter, usage };
      }),

      toolDefinition({
         name: "benefit_details",
         description:
            "Retorna um benefício do catálogo pelo ID. Use antes de alterar ou remover benefício existente.",
         inputSchema: resourceIdInputSchema,
         lazy: true,
      }).server(({ id }) => orpcClient.benefits.getBenefitById({ id })),

      toolDefinition({
         name: "coupon_details",
         description:
            "Retorna um cupom pelo ID. Use antes de alterar ou desativar cupom existente.",
         inputSchema: resourceIdInputSchema,
         lazy: true,
      }).server(({ id }) => orpcClient.coupons.get({ id })),

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
         name: "price_create",
         description:
            "Cria um preço para um serviço existente. Para novos serviços completos, prefira service_setup.",
         inputSchema: createPriceForServiceInputSchema,
         needsApproval: true,
         lazy: true,
      }).server((input) => orpcClient.prices.create(input)),

      toolDefinition({
         name: "price_update",
         description:
            "Atualiza um preço existente. Leia service_details antes para confirmar serviço e preço.",
         inputSchema: updatePriceInputSchema,
         needsApproval: true,
         lazy: true,
      }).server((input) => orpcClient.prices.update(input)),

      toolDefinition({
         name: "price_remove",
         description:
            "Remove um preço existente pelo ID. Use somente quando o usuário pedir exclusão.",
         inputSchema: resourceIdInputSchema,
         needsApproval: true,
         lazy: true,
      }).server(({ id }) => orpcClient.prices.remove({ id })),

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
         name: "meter_create",
         description:
            "Cria um medidor avulso para cobrança por uso ou benefícios de crédito.",
         inputSchema: createMeterSchema,
         needsApproval: true,
         lazy: true,
      }).server((input) => orpcClient.meters.createMeter(input)),

      toolDefinition({
         name: "meter_update",
         description:
            "Atualiza um medidor existente. Leia meter_details antes quando houver risco de afetar preços, benefícios ou cupons.",
         inputSchema: updateMeterInputSchema,
         needsApproval: true,
         lazy: true,
      }).server((input) => orpcClient.meters.updateMeterById(input)),

      toolDefinition({
         name: "meters_set_active",
         description:
            "Ativa ou arquiva medidores em lote. Use isActive=false para arquivar.",
         inputSchema: bulkResourceSetActiveInputSchema,
         needsApproval: true,
         lazy: true,
      }).server((input) => orpcClient.meters.bulkSetActive(input)),

      toolDefinition({
         name: "meter_remove",
         description:
            "Remove um medidor pelo ID. Prefira arquivar quando houver uso histórico ou vínculo.",
         inputSchema: resourceIdInputSchema,
         needsApproval: true,
         lazy: true,
      }).server(({ id }) => orpcClient.meters.removeMeter({ id })),

      toolDefinition({
         name: "benefit_create",
         description:
            "Cria um benefício avulso no catálogo. Para criar e anexar ao serviço em um passo, use service_benefit_create_attach.",
         inputSchema: createBenefitSchema,
         needsApproval: true,
         lazy: true,
      }).server((input) => orpcClient.benefits.createBenefit(input)),

      toolDefinition({
         name: "benefit_update",
         description:
            "Atualiza um benefício existente. Leia benefit_details antes quando necessário.",
         inputSchema: updateBenefitInputSchema,
         needsApproval: true,
         lazy: true,
      }).server((input) => orpcClient.benefits.updateBenefitById(input)),

      toolDefinition({
         name: "benefits_set_active",
         description:
            "Ativa ou arquiva benefícios em lote. Use isActive=false para arquivar.",
         inputSchema: bulkResourceSetActiveInputSchema,
         needsApproval: true,
         lazy: true,
      }).server((input) => orpcClient.benefits.bulkSetActive(input)),

      toolDefinition({
         name: "benefit_remove",
         description:
            "Remove um benefício pelo ID. Prefira arquivar quando houver uso histórico ou vínculo.",
         inputSchema: resourceIdInputSchema,
         needsApproval: true,
         lazy: true,
      }).server(({ id }) => orpcClient.benefits.removeBenefit({ id })),

      toolDefinition({
         name: "service_benefit_attach",
         description: "Anexa um benefício existente a um serviço existente.",
         inputSchema: serviceBenefitLinkInputSchema,
         needsApproval: true,
         lazy: true,
      }).server((input) => orpcClient.benefits.attachBenefit(input)),

      toolDefinition({
         name: "service_benefit_detach",
         description:
            "Remove o vínculo entre um benefício existente e um serviço existente.",
         inputSchema: serviceBenefitLinkInputSchema,
         needsApproval: true,
         lazy: true,
      }).server((input) => orpcClient.benefits.detachBenefit(input)),

      toolDefinition({
         name: "service_benefit_create_attach",
         description:
            "Cria um benefício novo e o anexa a um serviço existente em uma aprovação.",
         inputSchema: createAndAttachBenefitInputSchema,
         needsApproval: true,
         lazy: true,
      }).server((input) => orpcClient.benefits.createAndAttachBenefit(input)),

      toolDefinition({
         name: "coupon_create",
         description:
            "Cria cupom de desconto ou acréscimo para time, preço ou medidor.",
         inputSchema: createCouponSchema,
         needsApproval: true,
         lazy: true,
      }).server((input) => orpcClient.coupons.create(input)),

      toolDefinition({
         name: "coupon_update",
         description:
            "Atualiza um cupom existente. Leia coupon_details antes quando necessário.",
         inputSchema: updateCouponInputSchema,
         needsApproval: true,
         lazy: true,
      }).server((input) => orpcClient.coupons.update(input)),

      toolDefinition({
         name: "coupon_deactivate",
         description:
            "Desativa um cupom pelo ID. Use quando o usuário pedir para cancelar/desativar um cupom.",
         inputSchema: resourceIdInputSchema,
         needsApproval: true,
         lazy: true,
      }).server(({ id }) => orpcClient.coupons.deactivate({ id })),

      toolDefinition({
         name: "coupons_set_active",
         description:
            "Ativa ou arquiva cupons em lote. Use isActive=false para arquivar.",
         inputSchema: bulkResourceSetActiveInputSchema,
         needsApproval: true,
         lazy: true,
      }).server((input) => orpcClient.coupons.bulkSetActive(input)),

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
