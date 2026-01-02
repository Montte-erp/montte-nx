import { PlanName } from "@packages/stripe/constants";
import { useActiveOrganization } from "@/hooks/use-active-organization";

export type PlanFeatures = {
   canAccessAutomations: boolean;
   canAccessCostCenters: boolean;
   canAccessCounterparties: boolean;
   canAccessInterestTemplates: boolean;
   canAccessOrgMembers: boolean;
   canAccessTags: boolean;
   currentPlan: PlanName;
   isErpPlan: boolean;
   isBasicPlan: boolean;
   isFreePlan: boolean;
};

export function usePlanFeatures(): PlanFeatures {
   const { activeSubscription } = useActiveOrganization();

   const currentPlan =
      (activeSubscription?.plan?.toLowerCase() as PlanName) || PlanName.FREE;

   const isFreePlan = currentPlan === PlanName.FREE || !activeSubscription;
   const isBasicPlan = currentPlan === PlanName.BASIC;
   const isErpPlan = currentPlan === PlanName.ERP;

   return {
      // Tags: available for Basic and ERP (not Free)
      canAccessTags: isBasicPlan || isErpPlan,

      // Cost Centers: ERP only
      canAccessCostCenters: isErpPlan,

      // Counterparties (Fornecedores): ERP only
      canAccessCounterparties: isErpPlan,

      // Interest Templates: ERP only
      canAccessInterestTemplates: isErpPlan,

      // Automations: ERP only
      canAccessAutomations: isErpPlan,

      // Organization Members: ERP only
      canAccessOrgMembers: isErpPlan,

      // Plan identification helpers
      currentPlan,
      isFreePlan,
      isBasicPlan,
      isErpPlan,
   };
}
