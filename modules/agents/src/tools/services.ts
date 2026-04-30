import { toolDefinition } from "@tanstack/ai";
import { and, eq, inArray } from "drizzle-orm";
import { fromPromise } from "neverthrow";
import { z } from "zod";
import { serviceBenefits } from "@core/database/schemas/benefits";
import {
   createServiceSchema,
   services,
   updateServiceSchema,
} from "@core/database/schemas/services";
import type { ToolDeps } from "@modules/agents/tools/types";

const bulkCreateServicesInputSchema = z.object({
   items: z.array(createServiceSchema).min(1),
});

const idInput = z.object({
   id: z.string().uuid().describe("UUID do recurso."),
});

const listServicesInput = z.object({
   search: z
      .string()
      .optional()
      .describe("Busca parcial (ILIKE) por nome do serviço."),
   isActive: z
      .boolean()
      .optional()
      .describe("Filtra por ativo/arquivado. Omitir = ambos."),
});

const updateServiceInput = z
   .object({
      id: z.string().uuid().describe("UUID do serviço a atualizar."),
   })
   .merge(updateServiceSchema);

const setActiveInput = z.object({
   ids: z
      .array(z.string().uuid())
      .min(1)
      .describe("UUIDs dos serviços a atualizar (mínimo 1)."),
   isActive: z.boolean().describe("true = ativar, false = arquivar."),
});

const attachBenefitInput = z.object({
   serviceId: z.string().uuid().describe("UUID do serviço."),
   benefitId: z
      .string()
      .uuid()
      .describe("UUID do benefício existente a anexar."),
});

export function buildServicesTools(deps: ToolDeps) {
   const { db, teamId } = deps;

   const listServicesTool = toolDefinition({
      name: "services_list",
      description:
         "Lista os serviços do catálogo da equipe. Use para encontrar serviços existentes antes de criar duplicados.",
      inputSchema: listServicesInput,
      lazy: true,
   }).server(async ({ search, isActive }) => {
      const rows = await db.query.services.findMany({
         columns: {
            id: true,
            name: true,
            description: true,
            isActive: true,
            costPrice: true,
         },
         where: (f, { and: a, eq: e, ilike, sql }) =>
            a(
               e(f.teamId, teamId),
               isActive === undefined ? undefined : e(f.isActive, isActive),
               search ? ilike(f.name, sql`${`%${search}%`}`) : undefined,
            ),
         orderBy: (f, { desc }) => [desc(f.createdAt)],
         limit: 50,
      });
      return { count: rows.length, items: rows };
   });

   const getServiceTool = toolDefinition({
      name: "services_get",
      description: "Retorna um serviço com preços e benefícios anexados.",
      inputSchema: idInput,
      lazy: true,
   }).server(async ({ id }) => {
      const service = await db.query.services.findFirst({
         columns: {
            id: true,
            name: true,
            description: true,
            isActive: true,
            costPrice: true,
         },
         where: (f, { eq: e, and: a }) => a(e(f.id, id), e(f.teamId, teamId)),
         with: {
            prices: {
               columns: {
                  id: true,
                  name: true,
                  type: true,
                  interval: true,
                  basePrice: true,
                  meterId: true,
                  isActive: true,
               },
               orderBy: (f, { asc }) => [asc(f.createdAt)],
            },
            serviceBenefits: {
               columns: {},
               with: {
                  benefit: {
                     columns: {
                        id: true,
                        name: true,
                        type: true,
                        creditAmount: true,
                        meterId: true,
                     },
                  },
               },
            },
         },
      });
      if (!service) return { found: false as const };
      return {
         found: true as const,
         service: {
            id: service.id,
            name: service.name,
            description: service.description,
            isActive: service.isActive,
            costPrice: service.costPrice,
         },
         prices: service.prices,
         benefits: service.serviceBenefits.map((sb) => sb.benefit),
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
         db.transaction(async (tx) =>
            tx
               .insert(services)
               .values({ ...input, teamId })
               .returning(),
         ),
         () => "Falha ao criar serviço.",
      );
      if (result.isErr()) return { ok: false as const, error: result.error };
      const [row] = result.value;
      if (!row) return { ok: false as const, error: "Falha ao criar serviço." };
      return {
         ok: true as const,
         service: { id: row.id, name: row.name },
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
         db.transaction(async (tx) =>
            tx
               .update(services)
               .set(data)
               .where(and(eq(services.id, id), eq(services.teamId, teamId)))
               .returning(),
         ),
         () => "Falha ao atualizar serviço.",
      );
      if (result.isErr()) return { ok: false as const, error: result.error };
      const [row] = result.value;
      if (!row) return { ok: false as const, error: "Serviço não encontrado." };
      return {
         ok: true as const,
         service: { id: row.id, name: row.name },
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
         () => "Falha ao atualizar serviços.",
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
         () => "Falha ao criar serviços em lote.",
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
      const ownershipResult = await fromPromise(
         Promise.all([
            db.query.services.findFirst({
               columns: { id: true },
               where: (f, { and: a, eq: e }) =>
                  a(e(f.id, serviceId), e(f.teamId, teamId)),
            }),
            db.query.benefits.findFirst({
               columns: { id: true },
               where: (f, { and: a, eq: e }) =>
                  a(e(f.id, benefitId), e(f.teamId, teamId)),
            }),
         ]),
         () => "Falha ao verificar serviço/benefício.",
      );
      if (ownershipResult.isErr())
         return { ok: false as const, error: ownershipResult.error };
      const [service, benefit] = ownershipResult.value;
      if (!service || !benefit)
         return {
            ok: false as const,
            error: "Serviço ou benefício não pertence à equipe.",
         };

      const insertResult = await fromPromise(
         db.transaction(async (tx) =>
            tx
               .insert(serviceBenefits)
               .values({ serviceId, benefitId })
               .onConflictDoNothing(),
         ),
         () => "Falha ao anexar benefício.",
      );
      if (insertResult.isErr())
         return { ok: false as const, error: insertResult.error };
      return { ok: true as const, attached: { serviceId, benefitId } };
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
