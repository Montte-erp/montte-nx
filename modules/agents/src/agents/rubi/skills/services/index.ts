import { RUBI_PROMPTS, RUBI_SKILL_IDS } from "../../../../constants";
import { buildServiceTools } from "./tools";
import type { Skill } from "../types";

export const servicesSkill: Skill = {
   id: RUBI_SKILL_IDS.services,
   name: "Catálogo de Serviços",
   description:
      "Gerenciar o catálogo de serviços: criar/atualizar serviços, preços, medidores (meters) e benefícios.",
   promptName: RUBI_PROMPTS.skillServices,
   buildTools: buildServiceTools,
};
