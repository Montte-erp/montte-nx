import { createLocalStorageState } from "foxact/create-local-storage-state";
import { invariant } from "foxact/invariant";
import { usePostHog } from "posthog-js/react";
import {
   createContext,
   type ReactNode,
   useCallback,
   useContext,
   useEffect,
   useMemo,
   useState,
} from "react";
import type {
   EarlyAccessFeature,
   EarlyAccessStage,
} from "@/integrations/posthog/client";
import { normalizeEarlyAccessStage } from "@/integrations/posthog/client";

const [useEnrolledKeys] = createLocalStorageState<string[]>(
   "montte:early-access-enrolled",
   [],
);

const [useDismissedBannerFlags] = createLocalStorageState<string[]>(
   "montte:early-access-banner-dismissed",
   [],
);

type EarlyAccessContextValue = {
   features: EarlyAccessFeature[];
   isEnrolled: (flagKey: string) => boolean;
   getFeatureStage: (flagKey: string) => EarlyAccessStage | null;
   updateEnrollment: (flagKey: string, enrolled: boolean) => void;
   isBannerVisible: boolean;
   dismissBanner: () => void;
};

const EarlyAccessContext = createContext<EarlyAccessContextValue | null>(null);

export function EarlyAccessProvider({ children }: { children: ReactNode }) {
   const posthog = usePostHog();
   const [features, setFeatures] = useState<EarlyAccessFeature[]>([]);
   const [enrolledKeys, setEnrolledKeys] = useEnrolledKeys();
   const [dismissedFlags, setDismissedFlags] = useDismissedBannerFlags();

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
   }, [posthog]);

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

   const isBannerVisible = useMemo(
      () =>
         features.some(
            (f) =>
               f.flagKey &&
               !enrolledKeys.includes(f.flagKey) &&
               !dismissedFlags.includes(f.flagKey),
         ),
      [features, enrolledKeys, dismissedFlags],
   );

   const dismissBanner = useCallback(() => {
      setDismissedFlags(
         features
            .map((f) => f.flagKey)
            .filter((k): k is string => k !== null),
      );
   }, [features, setDismissedFlags]);

   const value = useMemo<EarlyAccessContextValue>(
      () => ({
         features,
         isEnrolled,
         getFeatureStage,
         updateEnrollment,
         isBannerVisible,
         dismissBanner,
      }),
      [
         features,
         isEnrolled,
         getFeatureStage,
         updateEnrollment,
         isBannerVisible,
         dismissBanner,
      ],
   );

   return (
      <EarlyAccessContext.Provider value={value}>
         {children}
      </EarlyAccessContext.Provider>
   );
}

export function useEarlyAccess() {
   const ctx = useContext(EarlyAccessContext);
   invariant(ctx, "useEarlyAccess must be used within EarlyAccessProvider");
   return ctx;
}
