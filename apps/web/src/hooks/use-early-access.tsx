import type { EarlyAccessFeature } from "@packages/posthog/client";
import {
   useEarlyAccessFeatures,
   usePosthogFeatureFlags,
} from "@packages/posthog/client";
import {
   createContext,
   type ReactNode,
   useCallback,
   useContext,
   useEffect,
   useMemo,
} from "react";
import { useSafeLocalStorage } from "@/hooks/use-local-storage";

type EnrolledFeaturesCache = Record<
   string,
   {
      enrolled: boolean;
      stage: "alpha" | "beta" | "concept" | "general-availability";
      name: string;
   }
>;

type EarlyAccessContextValue = {
   loaded: boolean;
   enrolledFeatures: Set<string>;
   features: EarlyAccessFeature[];
   isEnrolled: (flagKey: string) => boolean;
   getFeatureStage: (
      flagKey: string,
   ) => "alpha" | "beta" | "concept" | "general-availability" | null;
   updateEnrollment: (flagKey: string, isEnrolled: boolean) => void;
   isBannerVisible: boolean;
   dismissBanner: () => void;
};

// ---------------------------------------------------------------------------
// Source of truth for all known early access features.
// PostHog's getEarlyAccessFeatures is unreliable — define features here and
// check enrollment individually via isFeatureEnabled (mirrors the SSR pattern).
// ---------------------------------------------------------------------------
const STATIC_FEATURES: EarlyAccessFeature[] = [
   {
      flagKey: "contacts",
      name: "Contatos",
      description:
         "Cadastro de clientes e fornecedores, vinculação com transações e cobranças.",
      stage: "alpha",
      documentationUrl: null,
   },
   {
      flagKey: "inventory",
      name: "Produtos (Estoque)",
      description:
         "Cadastre e gerencie o catálogo de produtos da sua empresa — controle de estoque, preços, variantes e categorias.",
      stage: "alpha",
      documentationUrl: null,
   },
   {
      flagKey: "services",
      name: "Gestão de Serviços",
      description:
         "Gestão completa de serviços: planos, assinaturas, descontos negociados e faturamento recorrente.",
      stage: "alpha",
      documentationUrl: null,
   },
   {
      flagKey: "advanced-analytics",
      name: "Análises Avançadas",
      description:
         "Acesse dados avançados, dashboards personalizados e insights inteligentes em um só lugar. Tome decisões mais rápidas com uma visão completa do seu negócio.",
      stage: "beta",
      documentationUrl: null,
   },
];

const STATIC_FLAG_KEYS = new Set(
   STATIC_FEATURES.map((f) => f.flagKey).filter((k): k is string => k !== null),
);

const BANNER_DISMISSED_KEY = "montte:early-access-banner-dismissed";
const ENROLLED_FEATURES_CACHE_KEY = "montte:enrolled-features";

const EarlyAccessContext = createContext<EarlyAccessContextValue | null>(null);

export function EarlyAccessProvider({ children }: { children: ReactNode }) {
   const {
      features: posthogFeatures,
      loaded: posthogLoaded,
      updateEnrollment,
   } = useEarlyAccessFeatures();

   // Use feature flags directly to check enrollment — same pattern as SSR.
   const { flags, loaded: flagsLoaded } = usePosthogFeatureFlags();

   const [dismissedFlags, setDismissedFlagsState] = useSafeLocalStorage<
      string[]
   >(BANNER_DISMISSED_KEY, []);

   const [enrolledCache, setEnrolledCache] =
      useSafeLocalStorage<EnrolledFeaturesCache>(
         ENROLLED_FEATURES_CACHE_KEY,
         {},
      );

   // Merge: PostHog data overrides static when available (so stage/name updates
   // in PostHog are reflected). Static is the fallback when PostHog doesn't
   // return the feature (getEarlyAccessFeatures is unreliable).
   const mergedFeatures = useMemo<EarlyAccessFeature[]>(() => {
      const posthogByKey = new Map(
         posthogFeatures.filter((f) => f.flagKey).map((f) => [f.flagKey, f]),
      );
      const staticWithOverrides = STATIC_FEATURES.map((f) =>
         f.flagKey && posthogByKey.has(f.flagKey)
            ? (posthogByKey.get(f.flagKey) as EarlyAccessFeature)
            : f,
      );
      const extra = posthogFeatures.filter(
         (f) => f.flagKey && !STATIC_FLAG_KEYS.has(f.flagKey),
      );
      return [...staticWithOverrides, ...extra];
   }, [posthogFeatures]);

   // Enrollment: check feature flags directly for known flags, fall back to cache.
   const enrolledFeatures = useMemo(() => {
      const enrolled = new Set<string>();

      if (flagsLoaded) {
         for (const feature of mergedFeatures) {
            if (feature.flagKey && flags[feature.flagKey]) {
               enrolled.add(feature.flagKey);
            }
         }
      } else {
         // Before flags load, use cache.
         for (const [flagKey, entry] of Object.entries(enrolledCache)) {
            if (entry.enrolled) enrolled.add(flagKey);
         }
      }

      return enrolled;
   }, [flagsLoaded, flags, mergedFeatures, enrolledCache]);

   // Sync cache after flags load so it stays fresh for the next session.
   useEffect(() => {
      if (!flagsLoaded) return;
      setEnrolledCache((prev) => {
         const next: EnrolledFeaturesCache = { ...prev };
         for (const feature of mergedFeatures) {
            if (!feature.flagKey) continue;
            next[feature.flagKey] = {
               enrolled: Boolean(flags[feature.flagKey]),
               stage: feature.stage,
               name: feature.name,
            };
         }
         return next;
      });
   }, [flagsLoaded, flags, mergedFeatures, setEnrolledCache]);

   const loaded = flagsLoaded || posthogLoaded;

   const isEnrolledFn = useCallback(
      (flagKey: string) => enrolledFeatures.has(flagKey),
      [enrolledFeatures],
   );

   const getFeatureStage = useCallback(
      (flagKey: string) => {
         const feature = mergedFeatures.find((f) => f.flagKey === flagKey);
         return feature?.stage ?? null;
      },
      [mergedFeatures],
   );

   const updateEnrollmentWithCache = useCallback(
      (flagKey: string, isEnrolledValue: boolean) => {
         updateEnrollment(flagKey, isEnrolledValue);
         setEnrolledCache((prev) => {
            const existing = prev[flagKey];
            const stage = existing?.stage ?? getFeatureStage(flagKey) ?? "beta";
            const name = existing?.name ?? "";
            return {
               ...prev,
               [flagKey]: { enrolled: isEnrolledValue, stage, name },
            };
         });
      },
      [updateEnrollment, setEnrolledCache, getFeatureStage],
   );

   const isBannerVisible = useMemo(() => {
      if (!loaded || mergedFeatures.length === 0) return false;
      const dismissedSet = new Set(dismissedFlags);
      return mergedFeatures.some(
         (f) =>
            f.flagKey &&
            !enrolledFeatures.has(f.flagKey) &&
            !dismissedSet.has(f.flagKey),
      );
   }, [loaded, mergedFeatures, enrolledFeatures, dismissedFlags]);

   const dismissBanner = useCallback(() => {
      const allFlagKeys = mergedFeatures
         .map((f) => f.flagKey)
         .filter((k): k is string => k !== null);
      setDismissedFlagsState(allFlagKeys);
   }, [mergedFeatures, setDismissedFlagsState]);

   const value = useMemo<EarlyAccessContextValue>(
      () => ({
         loaded,
         enrolledFeatures,
         features: mergedFeatures,
         isEnrolled: isEnrolledFn,
         getFeatureStage,
         updateEnrollment: updateEnrollmentWithCache,
         isBannerVisible,
         dismissBanner,
      }),
      [
         loaded,
         enrolledFeatures,
         mergedFeatures,
         isEnrolledFn,
         getFeatureStage,
         updateEnrollmentWithCache,
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
   if (!ctx) {
      throw new Error("useEarlyAccess must be used within EarlyAccessProvider");
   }
   return ctx;
}
