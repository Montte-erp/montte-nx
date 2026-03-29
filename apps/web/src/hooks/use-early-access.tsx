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
import type { FeatureFlagKey } from "@core/posthog/config";

const [useDismissedBannerFlags] = createLocalStorageState<string[]>(
   "montte:early-access-banner-dismissed",
   [],
);

const STATIC_FEATURES: EarlyAccessFeature[] = [
   {
      flagKey: "contatos" satisfies FeatureFlagKey,
      name: "Contatos",
      description:
         "Cadastro de clientes e fornecedores, vinculação com transações e cobranças.",
      stage: "alpha",
      documentationUrl: null,
   },
   {
      flagKey: "produtos-estoque" satisfies FeatureFlagKey,
      name: "Produtos (Estoque)",
      description:
         "Cadastre e gerencie o catálogo de produtos da sua empresa — controle de estoque, preços, variantes e categorias.",
      stage: "beta",
      documentationUrl: null,
   },
   {
      flagKey: "gestao-de-servicos" satisfies FeatureFlagKey,
      name: "Gestão de Serviços",
      description:
         "Gestão completa de serviços: planos, assinaturas, descontos negociados e faturamento recorrente.",
      stage: "concept",
      documentationUrl: null,
   },
   {
      flagKey: "analises-avancadas" satisfies FeatureFlagKey,
      name: "Análises Avançadas",
      description:
         "Acesse dados avançados, dashboards personalizados e insights inteligentes em um só lugar.",
      stage: "beta",
      documentationUrl: null,
   },
   {
      flagKey: "dados" satisfies FeatureFlagKey,
      name: "Dados",
      description:
         "Pipeline de dados para captura de eventos externos via webhooks e SDKs.",
      stage: "concept",
      documentationUrl: null,
   },
];

const STATIC_FLAG_KEYS = new Set(
   STATIC_FEATURES.map((f) => f.flagKey as string),
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

   const [posthogFeatures, setPosthogFeatures] = useState<EarlyAccessFeature[]>(
      [],
   );
   const [enrolledKeys, setEnrolledKeys] = useState<Set<string>>(new Set());
   const [dismissedFlags, setDismissedFlags] = useDismissedBannerFlags();

   useEffect(() => {
      posthog.getEarlyAccessFeatures(
         (raw) => {
            setPosthogFeatures(
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

   useEffect(() => {
      const update = () => {
         setEnrolledKeys(
            new Set(
               STATIC_FEATURES.filter(
                  (f) => f.flagKey && posthog.isFeatureEnabled(f.flagKey),
               ).map((f) => f.flagKey as string),
            ),
         );
      };
      update();
      return posthog.onFeatureFlags(update);
   }, [posthog]);

   const features = useMemo<EarlyAccessFeature[]>(() => {
      if (posthogFeatures.length === 0) return STATIC_FEATURES;

      const byKey = new Map(
         posthogFeatures.filter((f) => f.flagKey).map((f) => [f.flagKey, f]),
      );

      const merged = STATIC_FEATURES.map((f) => {
         const remote = byKey.get(f.flagKey);
         return {
            flagKey: f.flagKey,
            name: remote?.name ?? f.name,
            description: remote?.description ?? f.description,
            stage: remote?.stage ?? f.stage,
            documentationUrl: remote?.documentationUrl ?? f.documentationUrl,
         } satisfies EarlyAccessFeature;
      });

      const extra = posthogFeatures.filter(
         (f) => f.flagKey && !STATIC_FLAG_KEYS.has(f.flagKey),
      );

      return [...merged, ...extra];
   }, [posthogFeatures]);

   const isEnrolled = useCallback(
      (flagKey: string) => enrolledKeys.has(flagKey),
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
            const next = new Set(prev);
            if (enrolled) next.add(flagKey);
            else next.delete(flagKey);
            return next;
         });
         posthog.updateEarlyAccessFeatureEnrollment(flagKey, enrolled);
      },
      [posthog],
   );

   const isBannerVisible = useMemo(
      () =>
         features.some(
            (f) =>
               f.flagKey &&
               !enrolledKeys.has(f.flagKey) &&
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
