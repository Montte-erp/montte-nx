import { toolDefinition } from "@tanstack/ai";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseInstance } from "@core/database/client";
import { benefits, serviceBenefits } from "@core/database/schemas/benefits";
import { meters } from "@core/database/schemas/meters";
import { services, servicePrices } from "@core/database/schemas/services";
import {
   createServiceSchema,
   updateServiceSchema,
   createPriceSchema,
   createMeterSchema,
   bulkCreateServicesInputSchema,
} from "@modules/billing/contracts/services";

export interface ServiceToolDeps {
   db: DatabaseInstance;
   teamId: string;
}

const listServicesInput = z.object({
   search: z.string().optional(),
   isActive: z.boolean().optional(),
});

const idInput = z.object({ id: z.string().uuid() });

const listMetersInput = z.object({
   search: z.string().optional(),
});

const listBenefitsInput = z.object({
   search: z.string().optional(),
});

const attachBenefitInput = z.object({
   serviceId: z.string().uuid(),
   benefitId: z.string().uuid(),
});

const createPriceForServiceInput = z
   .object({ serviceId: z.string().uuid() })
   .merge(createPriceSchema);

const updateServiceInput = z
   .object({ id: z.string().uuid() })
   .merge(updateServiceSchema);

export function buildServiceTools(deps: ServiceToolDeps) {
   const { db, teamId } = deps;

   const listServicesTool = toolDefinition({
      name: "services_list",
      description:
         "Lista os serviços do catálogo da equipe. Use para encontrar serviços existentes antes de criar duplicados.",
      inputSchema: listServicesInput,
   }).server(async ({ search, isActive }) => {
      const rows = await db
         .select({
            id: services.id,
            name: services.name,
            description: services.description,
            isActive: services.isActive,
            costPrice: services.costPrice,
         })
         .from(services)
         .where(
            and(
               eq(services.teamId, teamId),
               isActive === undefined
                  ? undefined
                  : eq(services.isActive, isActive),
               search ? ilike(services.name, `%${search}%`) : undefined,
            ),
         )
         .orderBy(desc(services.createdAt))
         .limit(50);
      return { services: rows };
   });

   const getServiceTool = toolDefinition({
      name: "services_get",
      description: "Retorna um serviço com preços e benefícios anexados.",
      inputSchema: idInput,
   }).server(async ({ id }) => {
      const service = await db.query.services.findFirst({
         where: (f, { eq: e, and: a }) => a(e(f.id, id), e(f.teamId, teamId)),
      });
      if (!service) return { service: null, prices: [], benefits: [] };
      const [prices, attached] = await Promise.all([
         db.select().from(servicePrices).where(eq(servicePrices.serviceId, id)),
         db
            .select({
               id: benefits.id,
               name: benefits.name,
               type: benefits.type,
            })
            .from(serviceBenefits)
            .innerJoin(benefits, eq(serviceBenefits.benefitId, benefits.id))
            .where(eq(serviceBenefits.serviceId, id)),
      ]);
      return { service, prices, benefits: attached };
   });

   const listMetersTool = toolDefinition({
      name: "meters_list",
      description: "Lista medidores (meters) da equipe.",
      inputSchema: listMetersInput,
   }).server(async ({ search }) => {
      const rows = await db
         .select({
            id: meters.id,
            name: meters.name,
            eventName: meters.eventName,
            aggregation: meters.aggregation,
            unitCost: meters.unitCost,
         })
         .from(meters)
         .where(
            and(
               eq(meters.teamId, teamId),
               search
                  ? or(
                       ilike(meters.name, `%${search}%`),
                       ilike(meters.eventName, `%${search}%`),
                    )
                  : undefined,
            ),
         )
         .limit(50);
      return { meters: rows };
   });

   const listBenefitsTool = toolDefinition({
      name: "benefits_list",
      description: "Lista benefícios da equipe.",
      inputSchema: listBenefitsInput,
   }).server(async ({ search }) => {
      const rows = await db
         .select({
            id: benefits.id,
            name: benefits.name,
            type: benefits.type,
            unitCost: benefits.unitCost,
            creditAmount: benefits.creditAmount,
         })
         .from(benefits)
         .where(
            and(
               eq(benefits.teamId, teamId),
               search ? ilike(benefits.name, `%${search}%`) : undefined,
            ),
         )
         .limit(50);
      return { benefits: rows };
   });

   const createServiceTool = toolDefinition({
      name: "services_create",
      description:
         "Cria um novo serviço no catálogo. Sempre confirme com o usuário antes de aplicar.",
      inputSchema: createServiceSchema,
      needsApproval: true,
   });

   const updateServiceTool = toolDefinition({
      name: "services_update",
      description:
         "Atualiza um serviço existente. Requer aprovação do usuário.",
      inputSchema: updateServiceInput,
      needsApproval: true,
   });

   const createPriceForServiceTool = toolDefinition({
      name: "services_create_price",
      description: "Cria um preço para um serviço existente. Requer aprovação.",
      inputSchema: createPriceForServiceInput,
      needsApproval: true,
   });

   const attachBenefitTool = toolDefinition({
      name: "services_attach_benefit",
      description: "Anexa um benefício a um serviço. Requer aprovação.",
      inputSchema: attachBenefitInput,
      needsApproval: true,
   });

   const createMeterTool = toolDefinition({
      name: "meters_create",
      description: "Cria um novo medidor (meter). Requer aprovação.",
      inputSchema: createMeterSchema,
      needsApproval: true,
   });

   const bulkCreateServicesTool = toolDefinition({
      name: "services_bulk_create",
      description:
         "Cria múltiplos serviços de uma vez (catálogo inicial). Requer aprovação.",
      inputSchema: bulkCreateServicesInputSchema,
      needsApproval: true,
   });

   return [
      listServicesTool,
      getServiceTool,
      listMetersTool,
      listBenefitsTool,
      createServiceTool,
      updateServiceTool,
      createPriceForServiceTool,
      attachBenefitTool,
      createMeterTool,
      bulkCreateServicesTool,
   ];
}
