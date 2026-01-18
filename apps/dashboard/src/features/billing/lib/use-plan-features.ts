import { PlanName } from "@packages/stripe/constants";
import { useActiveOrganization } from "@/hooks/use-active-organization";

export type PlanFeatures = {
   canAccessAiFeatures: boolean;
   canAccessAttachments: boolean;
   canAccessAutomations: boolean;
   canAccessCostCenters: boolean;
   canAccessCounterparties: boolean;
   canAccessInterestTemplates: boolean;
   canAccessOrgMembers: boolean;
   canAccessTags: boolean;
   currentPlan: PlanName;
   isBasicPlan: boolean;
   isErpPlan: boolean;
   isFreePlan: boolean;
   maxOrgMembers: number;
};

export function usePlanFeatures(): PlanFeatures {
   const { activeSubscription } = useActiveOrganization();

   const currentPlan =
      (activeSubscription?.plan?.toLowerCase() as PlanName) || PlanName.FREE;

   const isFreePlan = currentPlan === PlanName.FREE || !activeSubscription;
   const isBasicPlan = currentPlan === PlanName.BASIC;
   const isErpPlan = currentPlan === PlanName.ERP;

   return {
      // Tags: Now FREE for everyone
      canAccessTags: true,

      // Attachments: BASIC and ERP only (not Free)
      canAccessAttachments: isBasicPlan || isErpPlan,

      // AI features: BASIC and ERP (placeholder for future)
      canAccessAiFeatures: isBasicPlan || isErpPlan,

      // Organization Members: BASIC (2 users) and ERP (unlimited)
      canAccessOrgMembers: isBasicPlan || isErpPlan,
      maxOrgMembers: isErpPlan ? Infinity : isBasicPlan ? 2 : 1,

      // ERP-only features
      canAccessCostCenters: isErpPlan,
      canAccessCounterparties: isErpPlan,
      canAccessInterestTemplates: isErpPlan,
      canAccessAutomations: isErpPlan,

      // Plan identification helpers
      currentPlan,
      isFreePlan,
      isBasicPlan,
      isErpPlan,
   };
}
