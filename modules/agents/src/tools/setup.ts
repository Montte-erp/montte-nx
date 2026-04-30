import { toolDefinition } from "@tanstack/ai";
import { fromPromise } from "neverthrow";
import { z } from "zod";
import {
   benefits,
   createBenefitSchema,
   serviceBenefits,
} from "@core/database/schemas/benefits";
import { createMeterSchema, meters } from "@core/database/schemas/meters";
import {
   createPriceSchema,
   createServiceSchema,
   services,
   servicePrices,
} from "@core/database/schemas/services";
import type { ToolDeps } from "@modules/agents/tools/types";

const setupServiceInput = z.object({
   service: createServiceSchema.describe(
      "Dados base do serviço a criar (nome, descrição, costPrice, etc).",
   ),
   meter: z
      .union([
         z
            .object({ id: z.string().uuid() })
            .describe("UUID de medidor já existente para reusar."),
         createMeterSchema.describe("Dados de novo medidor a criar."),
      ])
      .optional()
      .describe(
         "Medidor para preços por consumo. Reusar (id) ou criar novo. Omitir se serviço não usa medidor.",
      ),
   prices: z
      .array(createPriceSchema)
      .optional()
      .default([])
      .describe(
         "Lista de preços a criar. Cada preço herda meterId do bloco meter quando não informado.",
      ),
   benefits: z
      .array(
         z.union([
            z
               .object({ id: z.string().uuid() })
               .describe("UUID de benefício já existente para anexar."),
            createBenefitSchema.describe("Dados de novo benefício a criar."),
         ]),
      )
      .optional()
      .default([])
      .describe(
         "Lista de benefícios a anexar. Reusar (id) ou criar novos. Novos benefícios herdam meterId do bloco meter quando não informado.",
      ),
});

export function buildSetupTools(deps: ToolDeps) {
   const { db, teamId } = deps;

   const setupServiceTool = toolDefinition({
      name: "services_setup",
      description:
         "PREFIRA ESTE TOOL para montar serviço completo de uma vez: cria/anexa medidor, cria preços, cria/anexa benefícios — tudo em UMA aprovação. Use ele em vez de encadear services_create + meters_create + services_create_price + benefits_create + services_attach_benefit. Apenas use os tools atômicos para ajustes pontuais em catálogo já existente.",
      inputSchema: setupServiceInput,
      needsApproval: true,
      lazy: true,
   }).server(async (input) => {
      const existingMeterId =
         input.meter && "id" in input.meter ? input.meter.id : null;
      const existingBenefitIds = (input.benefits ?? [])
         .filter((b): b is { id: string } => "id" in b)
         .map((b) => b.id);

      const ownershipResult = await fromPromise(
         Promise.all([
            existingMeterId
               ? db.query.meters.findFirst({
                    columns: { id: true, name: true },
                    where: (f, { and: a, eq: e }) =>
                       a(e(f.id, existingMeterId), e(f.teamId, teamId)),
                 })
               : Promise.resolve(null),
            existingBenefitIds.length
               ? db.query.benefits.findMany({
                    columns: { id: true, name: true },
                    where: (f, { and: a, eq: e, inArray }) =>
                       a(
                          e(f.teamId, teamId),
                          inArray(f.id, existingBenefitIds),
                       ),
                 })
               : Promise.resolve([]),
         ]),
         () => "Falha ao verificar medidor/benefícios existentes.",
      );
      if (ownershipResult.isErr())
         return { ok: false as const, error: ownershipResult.error };
      const [existingMeter, existingBenefits] = ownershipResult.value;

      if (existingMeterId && !existingMeter)
         return { ok: false as const, error: "Medidor não encontrado." };
      if (existingBenefitIds.length !== existingBenefits.length)
         return {
            ok: false as const,
            error: "Um ou mais benefícios não pertencem à equipe.",
         };

      const result = await fromPromise(
         db.transaction(async (tx) => {
            const [serviceRow] = await tx
               .insert(services)
               .values({ ...input.service, teamId })
               .returning();
            if (!serviceRow) throw new Error("rollback:service");

            let meterId: string | null = existingMeter?.id ?? null;
            let createdMeter: { id: string; name: string } | null = null;
            if (input.meter && !("id" in input.meter)) {
               const [meterRow] = await tx
                  .insert(meters)
                  .values({ ...input.meter, teamId })
                  .returning();
               if (!meterRow) throw new Error("rollback:meter");
               meterId = meterRow.id;
               createdMeter = { id: meterRow.id, name: meterRow.name };
            }

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

            const attachedBenefits: Array<{ id: string; name: string }> = [
               ...existingBenefits,
            ];
            for (const existing of existingBenefits) {
               await tx
                  .insert(serviceBenefits)
                  .values({
                     serviceId: serviceRow.id,
                     benefitId: existing.id,
                  })
                  .onConflictDoNothing();
            }

            const newBenefitsInput = (input.benefits ?? []).filter(
               (b): b is Exclude<typeof b, { id: string }> => !("id" in b),
            );
            for (const b of newBenefitsInput) {
               const [bRow] = await tx
                  .insert(benefits)
                  .values({
                     ...b,
                     teamId,
                     meterId: b.meterId ?? meterId ?? null,
                  })
                  .returning();
               if (!bRow) throw new Error("rollback:benefit");
               await tx
                  .insert(serviceBenefits)
                  .values({ serviceId: serviceRow.id, benefitId: bRow.id });
               attachedBenefits.push({ id: bRow.id, name: bRow.name });
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
         () => "Falha ao criar serviço completo.",
      );
      if (result.isErr()) return { ok: false as const, error: result.error };
      return { ok: true as const, ...result.value };
   });

   return [setupServiceTool];
}
