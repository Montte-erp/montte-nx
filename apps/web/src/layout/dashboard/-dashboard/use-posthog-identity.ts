import { useStableHandler } from "foxact/use-stable-handler-only-when-you-know-what-you-are-doing-or-you-will-be-fired";
import { usePostHog } from "posthog-js/react";
import { useEffect } from "react";

type IdentityProps = {
   userId: string | undefined;
   email: string | undefined;
   name: string | undefined;
   organizationId: string | undefined;
   organizationName: string | undefined;
   organizationSlug: string | undefined;
};

export function usePostHogIdentity({
   userId,
   email,
   name,
   organizationId,
   organizationName,
   organizationSlug,
}: IdentityProps) {
   const posthog = usePostHog();

   const identify = useStableHandler(() => {
      if (!userId) return;
      posthog.identify(userId, { email, name });
      if (organizationId) {
         posthog.group("organization", organizationId, {
            name: organizationName,
            slug: organizationSlug,
         });
      }
   });

   useEffect(() => {
      identify();
   }, [userId, organizationId, identify]);
}
