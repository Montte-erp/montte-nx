import { toolDefinition } from "@tanstack/ai";
import { and, asc, desc, eq, ilike, inArray } from "drizzle-orm";
import { fromPromise } from "neverthrow";
import { z } from "zod";
import { benefits, serviceBenefits } from "@core/database/schemas/benefits";
import { services, servicePrices } from "@core/database/schemas/services";
import {
   bulkCreateServicesInputSchema,
   createServiceSchema,
   updateServiceSchema,
} from "@modules/billing/contracts/services";
import type { SkillDeps } from "../../types";

const idInput = z.object({ id: z.string().uuid() });

const listServicesInput = z.object({
   search: z.string().optional(),
   isActive: z.boolean().optional(),
});

const updateServiceInput = z
   .object({ id: z.string().uuid() })
   .merge(updateServiceSchema);

const setActiveInput = z.object({
   ids: z.array(z.string().uuid()).min(1),
   isActive: z.boolean(),
});

const attachBenefitInput = z.object({
   serviceId: z.string().uuid(),
   benefitId: z.string().uuid(),
});

function errMessage(e: unknown) {
   return e instanceof Error ? e.message : String(e);
}

export function buildServicesTools(deps: SkillDeps) {
   const { db, teamId } = deps;

   const listServicesTool = toolDefinition({
      name: "services_list",
      description:
         "Lista os serviços do catálogo da equipe. Use para encontrar serviços existentes antes de criar duplicados.",
      inputSchema: listServicesInput,
      lazy: true,
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
      return { count: rows.length, items: rows };
   });

   const getServiceTool = toolDefinition({
      name: "services_get",
      description: "Retorna um serviço com preços e benefícios anexados.",
      inputSchema: idInput,
      lazy: true,
   }).server(async ({ id }) => {
      const service = await db.query.services.findFirst({
         where: (f, { eq: e, and: a }) => a(e(f.id, id), e(f.teamId, teamId)),
      });
      if (!service) return { found: false as const };
      const [prices, attached] = await Promise.all([
         db
            .select()
            .from(servicePrices)
            .where(eq(servicePrices.serviceId, id))
            .orderBy(asc(servicePrices.createdAt)),
         db
            .select({
               id: benefits.id,
               name: benefits.name,
               type: benefits.type,
               creditAmount: benefits.creditAmount,
               meterId: benefits.meterId,
            })
            .from(serviceBenefits)
            .innerJoin(benefits, eq(serviceBenefits.benefitId, benefits.id))
            .where(eq(serviceBenefits.serviceId, id)),
      ]);
      return {
         found: true as const,
         service: {
            id: service.id,
            name: service.name,
            description: service.description,
            isActive: service.isActive,
            costPrice: service.costPrice,
         },
         prices: prices.map((p) => ({
            id: p.id,
            name: p.name,
            type: p.type,
            interval: p.interval,
            basePrice: p.basePrice,
            meterId: p.meterId,
            isActive: p.isActive,
         })),
         benefits: attached,
      };
   });

   const createServiceTool = toolDefinition({
      name: "services_create",
      description:
         "Cria um serviço sem preço/medidor/benefício. Use services_setup quando o serviço precisar de preço ou benefícios — evita múltiplas aprovações.",
      inputSchema: createServiceSchema,
      needsApproval: true,
      lazy: true,
   }).server(async (input) => {
      const result = await fromPromise(
         db.transaction(async (tx) => {
            const [row] = await tx
               .insert(services)
               .values({ ...input, teamId })
               .returning();
            if (!row) throw new Error("Falha ao criar serviço.");
            return row;
         }),
         errMessage,
      );
      if (result.isErr()) return { ok: false as const, error: result.error };
      return {
         ok: true as const,
         service: { id: result.value.id, name: result.value.name },
      };
   });

   const updateServiceTool = toolDefinition({
      name: "services_update",
      description: "Atualiza um serviço existente.",
      inputSchema: updateServiceInput,
      needsApproval: true,
      lazy: true,
   }).server(async ({ id, ...data }) => {
      const result = await fromPromise(
         db.transaction(async (tx) => {
            const [row] = await tx
               .update(services)
               .set(data)
               .where(and(eq(services.id, id), eq(services.teamId, teamId)))
               .returning();
            if (!row) throw new Error("Serviço não encontrado.");
            return row;
         }),
         errMessage,
      );
      if (result.isErr()) return { ok: false as const, error: result.error };
      return {
         ok: true as const,
         service: { id: result.value.id, name: result.value.name },
      };
   });

   const setActiveServicesTool = toolDefinition({
      name: "services_set_active",
      description:
         "Ativa ou arquiva múltiplos serviços de uma vez. Use isActive=false para arquivar.",
      inputSchema: setActiveInput,
      needsApproval: true,
      lazy: true,
   }).server(async ({ ids, isActive }) => {
      const result = await fromPromise(
         db.transaction(async (tx) =>
            tx
               .update(services)
               .set({ isActive })
               .where(
                  and(inArray(services.id, ids), eq(services.teamId, teamId)),
               )
               .returning({ id: services.id, name: services.name }),
         ),
         errMessage,
      );
      if (result.isErr()) return { ok: false as const, error: result.error };
      return {
         ok: true as const,
         count: result.value.length,
         services: result.value,
         isActive,
      };
   });

   const bulkCreateServicesTool = toolDefinition({
      name: "services_bulk_create",
      description:
         "Cria múltiplos serviços (catálogo inicial) — sem preços/medidores/benefícios. Use só quando importar lista de nomes; para configuração rica use services_setup por serviço.",
      inputSchema: bulkCreateServicesInputSchema,
      needsApproval: true,
      lazy: true,
   }).server(async (input) => {
      const result = await fromPromise(
         db.transaction(async (tx) =>
            tx
               .insert(services)
               .values(input.items.map((item) => ({ ...item, teamId })))
               .returning(),
         ),
         errMessage,
      );
      if (result.isErr()) return { ok: false as const, error: result.error };
      if (result.value.length === 0)
         return { ok: false as const, error: "Nenhum serviço criado." };
      return {
         ok: true as const,
         count: result.value.length,
         services: result.value.map((r) => ({ id: r.id, name: r.name })),
      };
   });

   const attachBenefitTool = toolDefinition({
      name: "services_attach_benefit",
      description:
         "Anexa um benefício existente a um serviço já existente. Para criar benefício junto com serviço prefira services_setup.",
      inputSchema: attachBenefitInput,
      needsApproval: true,
      lazy: true,
   }).server(async ({ serviceId, benefitId }) => {
      const result = await fromPromise(
         db.transaction(async (tx) => {
            const ownership = await tx
               .select({ sId: services.id, bId: benefits.id })
               .from(services)
               .leftJoin(
                  benefits,
                  and(eq(benefits.id, benefitId), eq(benefits.teamId, teamId)),
               )
               .where(
                  and(eq(services.id, serviceId), eq(services.teamId, teamId)),
               )
               .limit(1);
            const found = ownership[0];
            if (!found || !found.bId)
               throw new Error("Serviço ou benefício não pertence à equipe.");
            await tx
               .insert(serviceBenefits)
               .values({ serviceId, benefitId })
               .onConflictDoNothing();
            return { serviceId, benefitId };
         }),
         errMessage,
      );
      if (result.isErr()) return { ok: false as const, error: result.error };
      return { ok: true as const, attached: result.value };
   });

   return [
      listServicesTool,
      getServiceTool,
      createServiceTool,
      updateServiceTool,
      setActiveServicesTool,
      bulkCreateServicesTool,
      attachBenefitTool,
   ];
}
