import { createLocalStorageState } from "foxact/create-local-storage-state";
import { usePostHog } from "posthog-js/react";
import { useCallback, useEffect } from "react";
import type {
   EarlyAccessFeature,
   EarlyAccessStage,
} from "@/integrations/posthog/client";
import { normalizeEarlyAccessStage } from "@/integrations/posthog/client";

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

export function useEarlyAccess() {
   const posthog = usePostHog();
   const [features, setFeatures] = useFeatures();
   const [enrolledKeys, setEnrolledKeys] = useEnrolledKeys();
   const [dismissedFlags, setDismissedFlags] = useDismissedFlags();

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
         },
         true,
      );
   }, [posthog, setFeatures]);

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
         setEnrolledKeys((prev) =>
            enrolled
               ? [...new Set([...prev, flagKey])]
               : prev.filter((k) => k !== flagKey),
         );
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
