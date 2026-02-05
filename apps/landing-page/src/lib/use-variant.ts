// apps/landing-page/src/lib/use-variant.ts
import { useEffect, useState } from "react";
import { trackVariantAssigned } from "./analytics";
import {
   type LandingPageVariant,
   POSTHOG_FLAG_KEY,
   VARIANT_STORAGE_KEY,
} from "./variants";

export function useVariant(pageName: string) {
   const [variant, setVariant] = useState<LandingPageVariant>(null);
   const [loading, setLoading] = useState(true);

   useEffect(() => {
      // SSR safety check
      if (typeof window === "undefined") {
         setLoading(false);
         return;
      }

      // Check localStorage first for consistency across pages
      const storedVariant = localStorage.getItem(VARIANT_STORAGE_KEY);

      if (storedVariant && storedVariant !== "null") {
         setVariant(storedVariant as LandingPageVariant);
         setLoading(false);
         return;
      }

      // If not in localStorage, evaluate feature flag
      const evaluateFlag = () => {
         if (!window.posthog) {
            setLoading(false);
            return;
         }

         const flagValue = window.posthog.getFeatureFlag(POSTHOG_FLAG_KEY);

         if (flagValue && typeof flagValue === "string") {
            const resolvedVariant = flagValue as LandingPageVariant;
            setVariant(resolvedVariant);
            localStorage.setItem(VARIANT_STORAGE_KEY, flagValue);
            trackVariantAssigned(resolvedVariant, pageName);
         }

         setLoading(false);
      };

      // PostHog might not be loaded yet, wait for it
      if (window.posthog) {
         evaluateFlag();
      } else {
         // Retry after a short delay
         const timeout = setTimeout(evaluateFlag, 500);
         return () => clearTimeout(timeout);
      }
   }, [pageName]);

   return { variant, loading };
}
