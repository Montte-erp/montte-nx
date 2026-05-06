import { toolDefinition } from "@tanstack/ai";
import { fromPromise } from "neverthrow";
import { z } from "zod";
import { WebAppError } from "@core/logging/errors";
import type { Prompts } from "@core/posthog/server";
import { AGENT_PROMPTS, AGENT_SKILL_IDS } from "@modules/agents/constants";

interface SkillMeta {
   id: string;
   name: string;
   description: string;
   promptName: string;
}

export const SKILLS: readonly SkillMeta[] = [
   {
      id: AGENT_SKILL_IDS.services,
      name: "Catálogo de Serviços",
      description:
         "Gerenciar o catálogo de serviços: criar/atualizar serviços, preços, medidores (meters) e benefícios.",
      promptName: AGENT_PROMPTS.skillServices,
   },
];

export function buildSkillCatalog(): string {
   return SKILLS.map((s) => `- \`${s.id}\` — ${s.name}: ${s.description}`).join(
      "\n",
   );
}

const skillDiscoverInputSchema = z.object({
   skillId: z
      .literal(AGENT_SKILL_IDS.services)
      .describe("Identificador da skill que deve ser carregada."),
});

export function buildSkillDiscoverTool(prompts: Prompts) {
   const skillIds = SKILLS.map((s) => s.id);
   return toolDefinition({
      name: "skill_discover",
      description: `Descobre o playbook detalhado de uma skill para pedidos operacionais do domínio. Use antes de ferramentas de domínio quando o usuário pedir análise, consulta ou ação. Não use em saudações, conversa social ou perguntas gerais sem intenção operacional. Skills disponíveis: [${skillIds.join(", ")}].`,
      inputSchema: skillDiscoverInputSchema,
   }).server(async ({ skillId }) => {
      const skill = SKILLS.find((s) => s.id === skillId);
      if (!skill)
         return {
            error: `Skill desconhecida: '${skillId}'. Disponíveis: ${skillIds.join(", ")}.`,
         };
      const templateResult = await fromPromise(
         prompts.get(skill.promptName, {
            withMetadata: false,
         }),
         () => `Falha ao carregar playbook da skill ${skill.name}.`,
      );
      if (templateResult.isErr())
         throw WebAppError.internal(templateResult.error);
      return {
         skillId,
         name: skill.name,
         playbook: prompts.compile(templateResult.value, {}),
      };
   });
}
