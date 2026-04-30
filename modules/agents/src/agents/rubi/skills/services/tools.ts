import { toolDefinition } from "@tanstack/ai";
import { and, asc, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { fromPromise } from "neverthrow";
import { z } from "zod";
import { benefits, serviceBenefits } from "@core/database/schemas/benefits";
import { coupons, createCouponSchema } from "@core/database/schemas/coupons";
import { meters } from "@core/database/schemas/meters";
import { services, servicePrices } from "@core/database/schemas/services";
import {
   bulkCreateServicesInputSchema,
   createBenefitSchema,
   createMeterSchema,
   createPriceSchema,
   createServiceSchema,
   updatePriceSchema,
   updateServiceSchema,
   updateMeterSchema,
} from "@modules/billing/contracts/services";
import dayjs from "dayjs";
import type { SkillDeps } from "../types";

const idInput = z.object({ id: z.string().uuid() });

const listServicesInput = z.object({
   search: z.string().optional(),
   isActive: z.boolean().optional(),
});
const listMetersInput = z.object({ search: z.string().optional() });
const listBenefitsInput = z.object({ search: z.string().optional() });
const listCouponsInput = z.object({ isActive: z.boolean().optional() });

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

const updatePriceInput = z
   .object({ id: z.string().uuid() })
   .merge(updatePriceSchema);

const updateMeterInput = z
   .object({ id: z.string().uuid() })
   .merge(updateMeterSchema);

const setActiveInput = z.object({
   ids: z.array(z.string().uuid()).min(1),
   isActive: z.boolean(),
});

// Composite — service + optional meter (new or existing) + prices[] + benefits[] (new or existing)
const setupServiceInput = z.object({
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

function errMessage(e: unknown) {
   return e instanceof Error ? e.message : String(e);
}

export function buildServiceTools(deps: SkillDeps) {
   const { db, teamId } = deps;

   // ---------- READ ----------

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

   const listMetersTool = toolDefinition({
      name: "meters_list",
      description:
         "Lista medidores (meters). Medidores rastreiam uso (eventos) e alimentam preços por consumo e benefícios com créditos.",
      inputSchema: listMetersInput,
      lazy: true,
   }).server(async ({ search }) => {
      const rows = await db
         .select({
            id: meters.id,
            name: meters.name,
            eventName: meters.eventName,
            aggregation: meters.aggregation,
            aggregationProperty: meters.aggregationProperty,
            unitCost: meters.unitCost,
            isActive: meters.isActive,
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
      return { count: rows.length, items: rows };
   });

   const listBenefitsTool = toolDefinition({
      name: "benefits_list",
      description:
         "Lista benefícios. Benefícios entregam valor (créditos em medidor, acesso, custom) e podem ser anexados a serviços.",
      inputSchema: listBenefitsInput,
      lazy: true,
   }).server(async ({ search }) => {
      const rows = await db
         .select({
            id: benefits.id,
            name: benefits.name,
            type: benefits.type,
            meterId: benefits.meterId,
            creditAmount: benefits.creditAmount,
            unitCost: benefits.unitCost,
            isActive: benefits.isActive,
         })
         .from(benefits)
         .where(
            and(
               eq(benefits.teamId, teamId),
               search ? ilike(benefits.name, `%${search}%`) : undefined,
            ),
         )
         .limit(50);
      return { count: rows.length, items: rows };
   });

   const listCouponsTool = toolDefinition({
      name: "coupons_list",
      description:
         "Lista cupons da equipe (descontos ou acréscimos). Cupons podem ter scope team/price/meter, gatilho code/auto, duração once/repeating/forever.",
      inputSchema: listCouponsInput,
      lazy: true,
   }).server(async ({ isActive }) => {
      const rows = await db
         .select({
            id: coupons.id,
            code: coupons.code,
            scope: coupons.scope,
            type: coupons.type,
            amount: coupons.amount,
            direction: coupons.direction,
            duration: coupons.duration,
            durationMonths: coupons.durationMonths,
            trigger: coupons.trigger,
            redeemBy: coupons.redeemBy,
            usedCount: coupons.usedCount,
            maxUses: coupons.maxUses,
            isActive: coupons.isActive,
         })
         .from(coupons)
         .where(
            and(
               eq(coupons.teamId, teamId),
               isActive === undefined
                  ? undefined
                  : eq(coupons.isActive, isActive),
            ),
         )
         .orderBy(asc(coupons.createdAt))
         .limit(50);
      return { count: rows.length, items: rows };
   });

   // ---------- WRITE ----------

   const setupServiceTool = toolDefinition({
      name: "services_setup",
      description:
         "PREFIRA ESTE TOOL para montar serviço completo de uma vez: cria/anexa medidor, cria preços, cria/anexa benefícios — tudo em UMA aprovação. Use ele em vez de encadear services_create + meters_create + services_create_price + benefits_create + services_attach_benefit. Apenas use os tools atômicos para ajustes pontuais em catálogo já existente.",
      inputSchema: setupServiceInput,
      needsApproval: true,
      lazy: true,
   }).server(async (input) => {
      const result = await fromPromise(
         db.transaction(async (tx) => {
            // 1. service
            const [serviceRow] = await tx
               .insert(services)
               .values({ ...input.service, teamId })
               .returning();
            if (!serviceRow) throw new Error("Falha ao criar serviço.");

            // 2. meter (optional, new or existing)
            let meterId: string | null = null;
            let createdMeter: { id: string; name: string } | null = null;
            if (input.meter) {
               if ("id" in input.meter) {
                  const owner = await tx
                     .select({ id: meters.id, name: meters.name })
                     .from(meters)
                     .where(
                        and(
                           eq(meters.id, input.meter.id),
                           eq(meters.teamId, teamId),
                        ),
                     )
                     .limit(1);
                  if (owner.length === 0)
                     throw new Error("Medidor não encontrado.");
                  meterId = owner[0]!.id;
               } else {
                  const [meterRow] = await tx
                     .insert(meters)
                     .values({ ...input.meter, teamId })
                     .returning();
                  if (!meterRow) throw new Error("Falha ao criar medidor.");
                  meterId = meterRow.id;
                  createdMeter = { id: meterRow.id, name: meterRow.name };
               }
            }

            // 3. prices
            const prices = input.prices ?? [];
            const priceRows = prices.length
               ? await tx
                    .insert(servicePrices)
                    .values(
                       prices.map((p) => ({
                          ...p,
                          teamId,
                          serviceId: serviceRow.id,
                          meterId: p.meterId ?? meterId ?? null,
                       })),
                    )
                    .returning()
               : [];

            // 4. benefits (existing or new) — attach all
            const attachedBenefits: Array<{ id: string; name: string }> = [];
            const benefitsInput = input.benefits ?? [];
            for (const b of benefitsInput) {
               if ("id" in b) {
                  const owner = await tx
                     .select({ id: benefits.id, name: benefits.name })
                     .from(benefits)
                     .where(
                        and(eq(benefits.id, b.id), eq(benefits.teamId, teamId)),
                     )
                     .limit(1);
                  if (owner.length === 0)
                     throw new Error("Benefício não encontrado.");
                  await tx
                     .insert(serviceBenefits)
                     .values({ serviceId: serviceRow.id, benefitId: b.id })
                     .onConflictDoNothing();
                  attachedBenefits.push(owner[0]!);
               } else {
                  const [bRow] = await tx
                     .insert(benefits)
                     .values({
                        ...b,
                        teamId,
                        meterId: b.meterId ?? meterId ?? null,
                     })
                     .returning();
                  if (!bRow) throw new Error("Falha ao criar benefício.");
                  await tx
                     .insert(serviceBenefits)
                     .values({ serviceId: serviceRow.id, benefitId: bRow.id });
                  attachedBenefits.push({ id: bRow.id, name: bRow.name });
               }
            }

            return {
               service: { id: serviceRow.id, name: serviceRow.name },
               meter: createdMeter ?? (meterId ? { id: meterId } : null),
               prices: priceRows.map((p) => ({
                  id: p.id,
                  name: p.name,
                  basePrice: p.basePrice,
                  interval: p.interval,
               })),
               benefits: attachedBenefits,
            };
         }),
         errMessage,
      );
      if (result.isErr()) return { ok: false as const, error: result.error };
      return { ok: true as const, ...result.value };
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

   const createPriceForServiceTool = toolDefinition({
      name: "services_create_price",
      description:
         "Cria um preço para um serviço já existente. Para serviço novo prefira services_setup.",
      inputSchema: createPriceForServiceInput,
      needsApproval: true,
      lazy: true,
   }).server(async ({ serviceId, ...priceData }) => {
      const result = await fromPromise(
         db.transaction(async (tx) => {
            const owner = await tx
               .select({ id: services.id })
               .from(services)
               .where(
                  and(eq(services.id, serviceId), eq(services.teamId, teamId)),
               )
               .limit(1);
            if (owner.length === 0) throw new Error("Serviço não encontrado.");
            const [row] = await tx
               .insert(servicePrices)
               .values({ ...priceData, teamId, serviceId })
               .returning();
            if (!row) throw new Error("Falha ao criar preço.");
            return row;
         }),
         errMessage,
      );
      if (result.isErr()) return { ok: false as const, error: result.error };
      return {
         ok: true as const,
         price: {
            id: result.value.id,
            name: result.value.name,
            basePrice: result.value.basePrice,
            interval: result.value.interval,
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
         db.transaction(async (tx) => {
            const [row] = await tx
               .update(servicePrices)
               .set(data)
               .where(
                  and(
                     eq(servicePrices.id, id),
                     eq(servicePrices.teamId, teamId),
                  ),
               )
               .returning();
            if (!row) throw new Error("Preço não encontrado.");
            return row;
         }),
         errMessage,
      );
      if (result.isErr()) return { ok: false as const, error: result.error };
      return {
         ok: true as const,
         price: {
            id: result.value.id,
            name: result.value.name,
            basePrice: result.value.basePrice,
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
         errMessage,
      );
      if (result.isErr()) return { ok: false as const, error: result.error };
      if (result.value.length === 0)
         return { ok: false as const, error: "Preço não encontrado." };
      return { ok: true as const, deleted: result.value[0]!.id };
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

   const createMeterTool = toolDefinition({
      name: "meters_create",
      description:
         "Cria um medidor avulso (sem vincular a serviço). Para serviço novo com preço por consumo prefira services_setup.",
      inputSchema: createMeterSchema,
      needsApproval: true,
      lazy: true,
   }).server(async (input) => {
      const result = await fromPromise(
         db.transaction(async (tx) => {
            const [row] = await tx
               .insert(meters)
               .values({ ...input, teamId })
               .returning();
            if (!row) throw new Error("Falha ao criar medidor.");
            return row;
         }),
         errMessage,
      );
      if (result.isErr()) return { ok: false as const, error: result.error };
      return {
         ok: true as const,
         meter: {
            id: result.value.id,
            name: result.value.name,
            eventName: result.value.eventName,
         },
      };
   });

   const updateMeterTool = toolDefinition({
      name: "meters_update",
      description: "Atualiza um medidor.",
      inputSchema: updateMeterInput,
      needsApproval: true,
      lazy: true,
   }).server(async ({ id, ...data }) => {
      const result = await fromPromise(
         db.transaction(async (tx) => {
            const [row] = await tx
               .update(meters)
               .set(data)
               .where(and(eq(meters.id, id), eq(meters.teamId, teamId)))
               .returning();
            if (!row) throw new Error("Medidor não encontrado.");
            return row;
         }),
         errMessage,
      );
      if (result.isErr()) return { ok: false as const, error: result.error };
      return {
         ok: true as const,
         meter: { id: result.value.id, name: result.value.name },
      };
   });

   const createBenefitTool = toolDefinition({
      name: "benefits_create",
      description:
         "Cria um benefício avulso (sem vincular a serviço). Para serviço novo com benefício prefira services_setup.",
      inputSchema: createBenefitSchema,
      needsApproval: true,
      lazy: true,
   }).server(async (input) => {
      const result = await fromPromise(
         db.transaction(async (tx) => {
            const [row] = await tx
               .insert(benefits)
               .values({ ...input, teamId })
               .returning();
            if (!row) throw new Error("Falha ao criar benefício.");
            return row;
         }),
         errMessage,
      );
      if (result.isErr()) return { ok: false as const, error: result.error };
      return {
         ok: true as const,
         benefit: {
            id: result.value.id,
            name: result.value.name,
            type: result.value.type,
         },
      };
   });

   const createCouponTool = toolDefinition({
      name: "coupons_create",
      description:
         "Cria um cupom (desconto ou acréscimo). scope: team/price/meter; type: percent/fixed; duration: once/repeating/forever; trigger: code/auto.",
      inputSchema: createCouponSchema,
      needsApproval: true,
      lazy: true,
   }).server(async (input) => {
      const existing = await db.query.coupons.findFirst({
         where: (f, { and: a, eq: e, sql }) =>
            a(
               e(f.teamId, teamId),
               sql`lower(${f.code}) = lower(${input.code})`,
            ),
      });
      if (existing)
         return {
            ok: false as const,
            error: "Já existe um cupom com esse código.",
         };
      const result = await fromPromise(
         db.transaction(async (tx) => {
            const [row] = await tx
               .insert(coupons)
               .values({
                  ...input,
                  teamId,
                  redeemBy: input.redeemBy
                     ? dayjs(input.redeemBy).toDate()
                     : undefined,
               })
               .returning();
            if (!row) throw new Error("Falha ao criar cupom.");
            return row;
         }),
         errMessage,
      );
      if (result.isErr()) return { ok: false as const, error: result.error };
      return {
         ok: true as const,
         coupon: {
            id: result.value.id,
            code: result.value.code,
            scope: result.value.scope,
            type: result.value.type,
            amount: result.value.amount,
         },
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

   return [
      // read
      listServicesTool,
      getServiceTool,
      listMetersTool,
      listBenefitsTool,
      listCouponsTool,
      // composite (preferred)
      setupServiceTool,
      // services
      createServiceTool,
      updateServiceTool,
      setActiveServicesTool,
      bulkCreateServicesTool,
      // prices
      createPriceForServiceTool,
      updatePriceTool,
      deletePriceTool,
      // benefits
      createBenefitTool,
      attachBenefitTool,
      // meters
      createMeterTool,
      updateMeterTool,
      // coupons
      createCouponTool,
   ];
}
