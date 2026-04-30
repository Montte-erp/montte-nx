import { toolDefinition } from "@tanstack/ai";
import { z } from "zod";
import { createCouponSchema } from "@core/database/schemas/coupons";
import type { ToolDeps } from "@modules/agents/tools/types";

const listInput = z.object({ isActive: z.boolean().optional() });

export function buildCouponsTools({ orpcClient }: ToolDeps) {
   return [
      toolDefinition({
         name: "coupons_list",
         description:
            "Lista cupons da equipe (descontos ou acréscimos). Cupons podem ter scope team/price/meter, gatilho code/auto, duração once/repeating/forever.",
         inputSchema: listInput,
         lazy: true,
      }).server(async ({ isActive }) => {
         const rows = await orpcClient.coupons.list();
         return isActive === undefined
            ? rows
            : rows.filter((c) => c.isActive === isActive);
      }),

      toolDefinition({
         name: "coupons_create",
         description:
            "Cria um cupom (desconto ou acréscimo). scope: team/price/meter; type: percent/fixed; duration: once/repeating/forever; trigger: code/auto.",
         inputSchema: createCouponSchema,
         needsApproval: true,
         lazy: true,
      }).server((input) => orpcClient.coupons.create(input)),
   ];
}
