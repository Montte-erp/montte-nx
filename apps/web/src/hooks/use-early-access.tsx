import { createLocalStorageState } from "foxact/create-local-storage-state";
import { usePostHog } from "posthog-js/react";
import { type ReactNode, useCallback, useEffect } from "react";
import type {
   EarlyAccessFeature,
   EarlyAccessStage,
} from "@/integrations/posthog/client";
import { normalizeEarlyAccessStage } from "@/integrations/posthog/client";

const ALL_STAGES: EarlyAccessStage[] = [
   "concept",
   "alpha",
   "beta",
   "general-availability",
];

const [useFeatures] = createLocalStorageState<EarlyAccessFeature[]>(
   "montte:early-access-features",
   [],
);

const [useEnrolledKeys] = createLocalStorageState<string[]>(
   "montte:early-access-enrolled",
   [],
);

const [useDismissedFlags] = createLocalStorageState<string[]>(
   "montte:early-access-banner-dismissed",
   [],
);

export function EarlyAccessProvider({ children }: { children: ReactNode }) {
   const posthog = usePostHog();
   const [, setFeatures] = useFeatures();
   const [, setEnrolledKeys] = useEnrolledKeys();

   useEffect(() => {
      posthog.getEarlyAccessFeatures(
         (raw) => {
            setFeatures(
               raw.map((f) => ({
                  flagKey: f.flagKey,
                  name: f.name,
                  description: f.description,
                  stage: normalizeEarlyAccessStage(f.stage),
                  documentationUrl: f.documentationUrl ?? null,
               })),
            );
            setEnrolledKeys((prev) => {
               const posthogKeys = new Set(
                  raw.map((f) => f.flagKey).filter(Boolean),
               );
               const preserved = (prev ?? []).filter(
                  (k) => !posthogKeys.has(k),
               );
               const posthogEnrolled = raw
                  .filter((f) => f.flagKey && posthog.isFeatureEnabled(f.flagKey))
                  .map((f) => f.flagKey as string);
               return [...new Set([...posthogEnrolled, ...preserved])];
            });
         },
         true,
         ALL_STAGES,
      );
   }, [posthog, setFeatures, setEnrolledKeys]);

   return <>{children}</>;
}

export function useEarlyAccess() {
   const posthog = usePostHog();
   const [features] = useFeatures();
   const [enrolledKeys, setEnrolledKeys] = useEnrolledKeys();
   const [dismissedFlags, setDismissedFlags] = useDismissedFlags();

   const isEnrolled = useCallback(
      (flagKey: string) => enrolledKeys.includes(flagKey),
      [enrolledKeys],
   );

   const getFeatureStage = useCallback(
      (flagKey: string): EarlyAccessStage | null =>
         features.find((f) => f.flagKey === flagKey)?.stage ?? null,
      [features],
   );

   const updateEnrollment = useCallback(
      (flagKey: string, enrolled: boolean) => {
         setEnrolledKeys((prev) => {
            const keys = prev ?? [];
            return enrolled
               ? [...new Set([...keys, flagKey])]
               : keys.filter((k) => k !== flagKey);
         });
         posthog.updateEarlyAccessFeatureEnrollment(flagKey, enrolled);
      },
      [posthog, setEnrolledKeys],
   );

   const isBannerVisible = features.some(
      (f) =>
         f.flagKey &&
         !enrolledKeys.includes(f.flagKey) &&
         !dismissedFlags.includes(f.flagKey),
   );

   const dismissBanner = useCallback(() => {
      setDismissedFlags(
         features.map((f) => f.flagKey).filter((k): k is string => k !== null),
      );
   }, [features, setDismissedFlags]);

   return {
      features,
      isEnrolled,
      getFeatureStage,
      updateEnrollment,
      isBannerVisible,
      dismissBanner,
   };
}
