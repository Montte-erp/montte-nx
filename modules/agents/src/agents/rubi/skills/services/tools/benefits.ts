import { toolDefinition } from "@tanstack/ai";
import { fromPromise } from "neverthrow";
import { z } from "zod";
import { benefits } from "@core/database/schemas/benefits";
import { createBenefitSchema } from "@modules/billing/contracts/services";
import type { SkillDeps } from "@modules/agents/agents/rubi/skills/types";

const listBenefitsInput = z.object({
   search: z
      .string()
      .optional()
      .describe("Busca parcial (ILIKE) por nome do benefício."),
});

export function buildBenefitsTools(deps: SkillDeps) {
   const { db, teamId } = deps;

   const listBenefitsTool = toolDefinition({
      name: "benefits_list",
      description:
         "Lista benefícios. Benefícios entregam valor (créditos em medidor, acesso, custom) e podem ser anexados a serviços.",
      inputSchema: listBenefitsInput,
      lazy: true,
   }).server(async ({ search }) => {
      const rows = await db.query.benefits.findMany({
         columns: {
            id: true,
            name: true,
            type: true,
            meterId: true,
            creditAmount: true,
            unitCost: true,
            isActive: true,
         },
         where: (f, { and: a, eq: e, ilike, sql }) =>
            a(
               e(f.teamId, teamId),
               search ? ilike(f.name, sql`${`%${search}%`}`) : undefined,
            ),
         limit: 50,
      });
      return { count: rows.length, items: rows };
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
         db.transaction(async (tx) =>
            tx
               .insert(benefits)
               .values({ ...input, teamId })
               .returning(),
         ),
         () => "Falha ao criar benefício.",
      );
      if (result.isErr()) return { ok: false as const, error: result.error };
      const [row] = result.value;
      if (!row)
         return { ok: false as const, error: "Falha ao criar benefício." };
      return {
         ok: true as const,
         benefit: {
            id: row.id,
            name: row.name,
            type: row.type,
         },
      };
   });

   return [listBenefitsTool, createBenefitTool];
}
