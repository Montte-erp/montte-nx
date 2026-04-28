import { Coins, FileText, KeyRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type BenefitTypeKey = "credits" | "feature_access" | "custom";

export const BENEFIT_TYPE_LABEL: Record<BenefitTypeKey, string> = {
   credits: "Cota por ciclo",
   feature_access: "Acesso contínuo",
   custom: "Personalizado",
};

export const BENEFIT_TYPE_ICON: Record<BenefitTypeKey, LucideIcon> = {
   credits: Coins,
   feature_access: KeyRound,
   custom: FileText,
};

export const BENEFIT_TYPE_HELPER: Record<BenefitTypeKey, string> = {
   credits:
      "Cliente consome N por ciclo. Ex: 1000 chamadas IA, 20h de sala, 100 impressões.",
   feature_access:
      "Acesso contínuo enquanto a assinatura está ativa. Ex: lounge, vaga de garagem, modo Pro.",
   custom: "Texto livre — descreva o que o cliente recebe.",
};

export function buildBenefitTypeOptions() {
   return (Object.keys(BENEFIT_TYPE_LABEL) as BenefitTypeKey[]).map((key) => ({
      label: BENEFIT_TYPE_LABEL[key],
      value: key,
   }));
}
