import { RUBI_PROMPTS, RUBI_SKILL_IDS } from "../../../../constants";
import { buildBenefitsTools } from "./tools/benefits";
import { buildCouponsTools } from "./tools/coupons";
import { buildMetersTools } from "./tools/meters";
import { buildPricesTools } from "./tools/prices";
import { buildServicesTools } from "./tools/services";
import { buildSetupTools } from "./tools/setup";
import type { Skill, SkillDeps } from "../types";

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
