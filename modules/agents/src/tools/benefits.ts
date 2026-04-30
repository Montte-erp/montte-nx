import { toolDefinition } from "@tanstack/ai";
import { z } from "zod";
import { createBenefitSchema } from "@core/database/schemas/benefits";
import type { ToolDeps } from "@modules/agents/tools/types";

const listInput = z.object({ search: z.string().optional() });

export function buildBenefitsTools({ orpcClient }: ToolDeps) {
   return [
      toolDefinition({
         name: "benefits_list",
         description:
            "Lista benefícios. Benefícios entregam valor (créditos em medidor, acesso, custom) e podem ser anexados a serviços.",
         inputSchema: listInput,
         lazy: true,
      }).server((input) => orpcClient.benefits.getBenefits(input)),

      toolDefinition({
         name: "benefits_create",
         description:
            "Cria um benefício avulso (sem vincular a serviço). Para serviço novo com benefício prefira services_setup.",
         inputSchema: createBenefitSchema,
         needsApproval: true,
         lazy: true,
      }).server((input) => orpcClient.benefits.createBenefit(input)),
   ];
}
