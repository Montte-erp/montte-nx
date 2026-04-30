import { toolDefinition } from "@tanstack/ai";
import { and, eq } from "drizzle-orm";
import { fromPromise } from "neverthrow";
import { z } from "zod";
import { benefits, serviceBenefits } from "@core/database/schemas/benefits";
import { meters } from "@core/database/schemas/meters";
import { services, servicePrices } from "@core/database/schemas/services";
import {
   createBenefitSchema,
   createMeterSchema,
   createPriceSchema,
   createServiceSchema,
} from "@modules/billing/contracts/services";
import type { SkillDeps } from "../../types";

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

export function buildSetupTools(deps: SkillDeps) {
   const { db, teamId } = deps;

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
            const [serviceRow] = await tx
               .insert(services)
               .values({ ...input.service, teamId })
               .returning();
            if (!serviceRow) throw new Error("Falha ao criar serviço.");

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

   return [setupServiceTool];
}
