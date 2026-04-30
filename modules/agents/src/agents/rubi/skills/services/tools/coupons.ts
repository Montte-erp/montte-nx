import { toolDefinition } from "@tanstack/ai";
import { and, asc, eq } from "drizzle-orm";
import { fromPromise } from "neverthrow";
import { z } from "zod";
import { coupons, createCouponSchema } from "@core/database/schemas/coupons";
import dayjs from "dayjs";
import type { SkillDeps } from "../../types";

const listCouponsInput = z.object({ isActive: z.boolean().optional() });

function errMessage(e: unknown) {
   return e instanceof Error ? e.message : String(e);
}

export function buildCouponsTools(deps: SkillDeps) {
   const { db, teamId } = deps;

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

   return [listCouponsTool, createCouponTool];
}
