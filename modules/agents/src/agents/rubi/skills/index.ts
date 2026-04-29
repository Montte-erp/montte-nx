import { toolDefinition } from "@tanstack/ai";
import { z } from "zod";
import type { Prompts } from "@core/posthog/server";
import { servicesSkill } from "./services";
import type { Skill, SkillDeps } from "./types";

export const RUBI_SKILLS: readonly Skill[] = [servicesSkill];

export function getSkillById(id: string): Skill | undefined {
   return RUBI_SKILLS.find((s) => s.id === id);
}

export function buildSkillCatalog(): string {
   return RUBI_SKILLS.map(
      (s) => `- \`${s.id}\` — ${s.name}: ${s.description}`,
   ).join("\n");
}

export function buildAllSkillTools(deps: SkillDeps) {
   return RUBI_SKILLS.flatMap((s) => s.buildTools(deps));
}

export interface SkillDiscoverDeps {
   prompts: Prompts;
}

export function buildSkillDiscoverTool(deps: SkillDiscoverDeps) {
   const skillIds = RUBI_SKILLS.map((s) => s.id);
   const description = `Descobre o playbook detalhado de uma skill. CHAME ESTA FERRAMENTA antes de usar qualquer ferramenta de domínio. Skills disponíveis: [${skillIds.join(", ")}].`;

   return toolDefinition({
      name: "skill_discover",
      description,
      inputSchema: z.object({
         skillId: z
            .string()
            .describe(`Identificador da skill. Um de: ${skillIds.join(", ")}.`),
      }),
   }).server(async ({ skillId }) => {
      const skill = getSkillById(skillId);
      if (!skill) {
         return {
            error: `Skill desconhecida: '${skillId}'. Disponíveis: ${skillIds.join(", ")}.`,
         };
      }
      const template = await deps.prompts.get(skill.promptName, {
         fallback: `Playbook da skill ${skill.name} indisponível no momento.`,
      });
      return {
         skillId: skill.id,
         name: skill.name,
         playbook: deps.prompts.compile(template, {}),
      };
   });
}
