import { useSuspenseQuery } from "@tanstack/react-query";
import { orpc } from "@/integrations/orpc/client";

export function useAccountType() {
   const { data } = useSuspenseQuery(
      orpc.onboarding.getOnboardingStatus.queryOptions({}),
   );

   const accountType = data.project.accountType ?? "personal";

   return {
      accountType,
      isBusiness: accountType === "business",
      isPersonal: accountType === "personal",
   } as const;
}
