import { useSuspenseQuery } from "@tanstack/react-query";
import { orpc } from "@/integrations/orpc/client";

export function useOnboardingStatus() {
   return useSuspenseQuery(
      orpc.onboarding.getOnboardingStatus.queryOptions({}),
   );
}

export function useIsOrgOnboardingComplete() {
   const { data } = useOnboardingStatus();
   return data.organization.onboardingCompleted ?? false;
}

export function useIsProjectOnboardingComplete() {
   const { data } = useOnboardingStatus();
   return data.project.onboardingCompleted ?? false;
}
