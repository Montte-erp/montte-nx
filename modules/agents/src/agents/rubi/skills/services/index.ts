import { RUBI_PROMPTS, RUBI_SKILL_IDS } from "@modules/agents/constants";
import { buildBenefitsTools } from "@modules/agents/agents/rubi/skills/services/tools/benefits";
import { buildCouponsTools } from "@modules/agents/agents/rubi/skills/services/tools/coupons";
import { buildMetersTools } from "@modules/agents/agents/rubi/skills/services/tools/meters";
import { buildPricesTools } from "@modules/agents/agents/rubi/skills/services/tools/prices";
import { buildServicesTools } from "@modules/agents/agents/rubi/skills/services/tools/services";
import { buildSetupTools } from "@modules/agents/agents/rubi/skills/services/tools/setup";
import type {
   Skill,
   SkillDeps,
} from "@modules/agents/agents/rubi/skills/types";

function buildServiceTools(deps: SkillDeps) {
   return [
      ...buildSetupTools(deps),
      ...buildServicesTools(deps),
      ...buildPricesTools(deps),
      ...buildMetersTools(deps),
      ...buildBenefitsTools(deps),
      ...buildCouponsTools(deps),
   ];
}

export const servicesSkill: Skill = {
   id: RUBI_SKILL_IDS.services,
   name: "Catálogo de Serviços",
   description:
      "Gerenciar o catálogo de serviços: criar/atualizar serviços, preços, medidores (meters) e benefícios.",
   promptName: RUBI_PROMPTS.skillServices,
   buildTools: buildServiceTools,
};
