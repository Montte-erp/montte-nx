import { toolDefinition } from "@tanstack/ai";
import { fromPromise } from "neverthrow";
import { z } from "zod";
import { coupons, createCouponSchema } from "@core/database/schemas/coupons";
import dayjs from "dayjs";
import type { SkillDeps } from "@modules/agents/agents/rubi/skills/types";

const listCouponsInput = z.object({
   isActive: z
      .boolean()
      .optional()
      .describe("Filtra por ativo/inativo. Omitir = ambos."),
});

export function buildCouponsTools(deps: SkillDeps) {
   const { db, teamId } = deps;

   const listCouponsTool = toolDefinition({
      name: "coupons_list",
      description:
         "Lista cupons da equipe (descontos ou acréscimos). Cupons podem ter scope team/price/meter, gatilho code/auto, duração once/repeating/forever.",
      inputSchema: listCouponsInput,
      lazy: true,
   }).server(async ({ isActive }) => {
      const rows = await db.query.coupons.findMany({
         columns: {
            id: true,
            code: true,
            scope: true,
            type: true,
            amount: true,
            direction: true,
            duration: true,
            durationMonths: true,
            trigger: true,
            redeemBy: true,
            usedCount: true,
            maxUses: true,
            isActive: true,
         },
         where: (f, { and: a, eq: e }) =>
            a(
               e(f.teamId, teamId),
               isActive === undefined ? undefined : e(f.isActive, isActive),
            ),
         orderBy: (f, { asc }) => [asc(f.createdAt)],
         limit: 50,
      });
      return { count: rows.length, items: rows };
   });

   const createCouponTool = toolDefinition({
      name: "coupons_create",
      description:
         "Cria um cupom (desconto ou acréscimo). scope: team/price/meter; type: percent/fixed; duration: once/repeating/forever; trigger: code/auto.",
      inputSchema: createCouponSchema,
      needsApproval: true,
      lazy: true,
   }).server(async (input) => {
      const existingResult = await fromPromise(
         db.query.coupons.findFirst({
            columns: { id: true },
            where: (f, { and: a, eq: e, sql }) =>
               a(
                  e(f.teamId, teamId),
                  sql`lower(${f.code}) = lower(${input.code})`,
               ),
         }),
         () => "Falha ao verificar cupom existente.",
      );
      if (existingResult.isErr())
         return { ok: false as const, error: existingResult.error };
      if (existingResult.value)
         return {
            ok: false as const,
            error: "Já existe um cupom com esse código.",
         };

      const result = await fromPromise(
         db.transaction(async (tx) =>
            tx
               .insert(coupons)
               .values({
                  ...input,
                  teamId,
                  redeemBy: input.redeemBy
                     ? dayjs(input.redeemBy).toDate()
                     : undefined,
               })
               .returning(),
         ),
         () => "Falha ao criar cupom.",
      );
      if (result.isErr()) return { ok: false as const, error: result.error };
      const [row] = result.value;
      if (!row) return { ok: false as const, error: "Falha ao criar cupom." };
      return {
         ok: true as const,
         coupon: {
            id: row.id,
            code: row.code,
            scope: row.scope,
            type: row.type,
            amount: row.amount,
         },
      };
   });

   return [listCouponsTool, createCouponTool];
}
