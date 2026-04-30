import { toolDefinition } from "@tanstack/ai";
import { and, eq, ilike } from "drizzle-orm";
import { fromPromise } from "neverthrow";
import { z } from "zod";
import { benefits } from "@core/database/schemas/benefits";
import { createBenefitSchema } from "@modules/billing/contracts/services";
import type { SkillDeps } from "../../types";

const listBenefitsInput = z.object({ search: z.string().optional() });

function errMessage(e: unknown) {
   return e instanceof Error ? e.message : String(e);
}

export function buildBenefitsTools(deps: SkillDeps) {
   const { db, teamId } = deps;

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

   return [listBenefitsTool, createBenefitTool];
}
