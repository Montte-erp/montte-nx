import { toolDefinition } from "@tanstack/ai";
import { fromPromise } from "neverthrow";
import { z } from "zod";
import type { Prompts } from "@core/posthog/server";
import { RUBI_PROMPTS, RUBI_SKILL_IDS } from "@modules/agents/constants";

interface SkillMeta {
   id: string;
   name: string;
   description: string;
   promptName: string;
}

export const SKILLS: readonly SkillMeta[] = [
   {
      id: RUBI_SKILL_IDS.services,
      name: "Catálogo de Serviços",
      description:
         "Gerenciar o catálogo de serviços: criar/atualizar serviços, preços, medidores (meters) e benefícios.",
      promptName: RUBI_PROMPTS.skillServices,
   },
];

export function buildSkillCatalog(): string {
   return SKILLS.map((s) => `- \`${s.id}\` — ${s.name}: ${s.description}`).join(
      "\n",
   );
}

export function buildSkillDiscoverTool(prompts: Prompts) {
   const skillIds = SKILLS.map((s) => s.id);
   return toolDefinition({
      name: "skill_discover",
      description: `Descobre o playbook detalhado de uma skill. CHAME ESTA FERRAMENTA antes de usar qualquer ferramenta de domínio. Skills disponíveis: [${skillIds.join(", ")}].`,
      inputSchema: z.object({
         skillId: z
            .string()
            .describe(`Identificador da skill. Um de: ${skillIds.join(", ")}.`),
      }),
   }).server(async ({ skillId }) => {
      const skill = SKILLS.find((s) => s.id === skillId);
      if (!skill)
         return {
            error: `Skill desconhecida: '${skillId}'. Disponíveis: ${skillIds.join(", ")}.`,
         };
      const templateResult = await fromPromise(
         prompts.get(skill.promptName, {
            withMetadata: false,
            fallback: `Playbook da skill ${skill.name} indisponível no momento.`,
         }),
         () => `Falha ao carregar playbook da skill ${skill.name}.`,
      );
      if (templateResult.isErr())
         return { skillId, name: skill.name, error: templateResult.error };
      return {
         skillId,
         name: skill.name,
         playbook: prompts.compile(templateResult.value, {}),
      };
   });
}
