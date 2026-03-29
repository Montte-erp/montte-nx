import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
   createContext,
   type ReactNode,
   useCallback,
   useContext,
   useEffect,
   useMemo,
   useState,
} from "react";
import { orpc } from "@/integrations/orpc/client";
import { usePostHog } from "posthog-js/react";
import type {
   EarlyAccessFeature,
   EarlyAccessStage,
} from "@/integrations/posthog/client";
import { normalizeEarlyAccessStage } from "@/integrations/posthog/client";
import type { FeatureFlagKey } from "@core/posthog/feature-flags";

type EarlyAccessContextValue = {
   features: EarlyAccessFeature[];
   isEnrolled: (flagKey: string) => boolean;
   getFeatureStage: (flagKey: string) => EarlyAccessStage | null;
   updateEnrollment: (flagKey: string, isEnrolled: boolean) => void;
   isBannerVisible: boolean;
   dismissBanner: () => void;
};

const STATIC_FEATURES: Array<{
   flagKey: FeatureFlagKey;
   name: string;
   description: string;
   documentationUrl: string | null;
}> = [
   {
      flagKey: "contatos",
      name: "Contatos",
      description:
         "Cadastro de clientes e fornecedores, vinculação com transações e cobranças.",
      documentationUrl: null,
   },
   {
      flagKey: "produtos-estoque",
      name: "Produtos (Estoque)",
      description:
         "Cadastre e gerencie o catálogo de produtos da sua empresa — controle de estoque, preços, variantes e categorias.",
      documentationUrl: null,
   },
   {
      flagKey: "gestao-de-servicos",
      name: "Gestão de Serviços",
      description:
         "Gestão completa de serviços: planos, assinaturas, descontos negociados e faturamento recorrente.",
      documentationUrl: null,
   },
   {
      flagKey: "analises-avancadas",
      name: "Análises Avançadas",
      description:
         "Acesse dados avançados, dashboards personalizados e insights inteligentes em um só lugar. Tome decisões mais rápidas com uma visão completa do seu negócio.",
      documentationUrl: null,
   },
   {
      flagKey: "dados",
      name: "Dados",
      description:
         "Pipeline de dados para captura de eventos externos via webhooks e SDKs, configuração de destinos e gerenciamento de schema — infraestrutura para integrações com sistemas externos.",
      documentationUrl: null,
   },
];

const STATIC_FLAG_KEYS = new Set(STATIC_FEATURES.map((f) => f.flagKey));

const EarlyAccessContext = createContext<EarlyAccessContextValue | null>(null);

export function EarlyAccessProvider({ children }: { children: ReactNode }) {
   const posthogClient = usePostHog();
   const queryClient = useQueryClient();

   // Enrollment from SSR (prefetched in _dashboard beforeLoad).
   // useSuspenseQuery guarantees data is defined.
   const { data } = useSuspenseQuery(
      orpc.earlyAccess.getEnrolledFeatures.queryOptions(),
   );

   const enrolledSet = useMemo(() => new Set(data.enrolled), [data]);

   // PostHog early access features (for stage/name overrides only)
   const [posthogFeatures, setPosthogFeatures] = useState<EarlyAccessFeature[]>(
      [],
   );

   // Dismissed banner flags (in-memory, resets per session)
   const [dismissedFlags, setDismissedFlags] = useState<Set<string>>(new Set());

   useEffect(() => {
      posthogClient.getEarlyAccessFeatures(
         (rawFeatures: Array<EarlyAccessFeature & { stage?: string }>) => {
            setPosthogFeatures(
               rawFeatures.map((f) => ({
                  ...f,
                  stage: normalizeEarlyAccessStage(f.stage),
               })),
            );
         },
         true,
      );
   }, [posthogClient]);

   const features = useMemo<EarlyAccessFeature[]>(() => {
      const posthogByKey = new Map(
         posthogFeatures.filter((f) => f.flagKey).map((f) => [f.flagKey, f]),
      );

      const merged = STATIC_FEATURES.map((f) => {
         const fromPosthog = posthogByKey.get(f.flagKey);
         return {
            flagKey: f.flagKey,
            name: fromPosthog?.name ?? f.name,
            description: fromPosthog?.description ?? f.description,
            documentationUrl: fromPosthog?.documentationUrl ?? f.documentationUrl,
            stage: fromPosthog?.stage ?? null,
         } satisfies EarlyAccessFeature;
      });

      const extra = posthogFeatures.filter(
         (f) => f.flagKey && !STATIC_FLAG_KEYS.has(f.flagKey as FeatureFlagKey),
      );

      return [...merged, ...extra];
   }, [posthogFeatures]);

   const isEnrolled = useCallback(
      (flagKey: string) => enrolledSet.has(flagKey),
      [enrolledSet],
   );

   const getFeatureStage = useCallback(
      (flagKey: string): EarlyAccessStage | null => {
         const f = features.find((feat) => feat.flagKey === flagKey);
         return f?.stage ?? null;
      },
      [features],
   );

   const handleUpdateEnrollment = useCallback(
      (flagKey: string, value: boolean) => {
         const queryKey =
            orpc.earlyAccess.getEnrolledFeatures.queryOptions().queryKey;

         // Optimistically update the query cache
         queryClient.setQueryData<{ enrolled: string[] }>(queryKey, (old) => {
            const current = old?.enrolled ?? [];
            const enrolled = value
               ? [...new Set([...current, flagKey])]
               : current.filter((k) => k !== flagKey);
            return { enrolled };
         });

         // Use the native posthog-js SDK method — it handles
         // $feature_enrollment_update event + $set person property
         posthogClient.updateEarlyAccessFeatureEnrollment(flagKey, value);
      },
      [queryClient, posthogClient],
   );

   const isBannerVisible = useMemo(() => {
      if (features.length === 0) return false;
      return features.some(
         (f) =>
            f.flagKey &&
            !enrolledSet.has(f.flagKey) &&
            !dismissedFlags.has(f.flagKey),
      );
   }, [features, enrolledSet, dismissedFlags]);

   const dismissBanner = useCallback(() => {
      const allKeys = new Set(
         features.map((f) => f.flagKey).filter((k): k is string => k !== null),
      );
      setDismissedFlags(allKeys);
   }, [features]);

   const value = useMemo<EarlyAccessContextValue>(
      () => ({
         features,
         isEnrolled,
         getFeatureStage,
         updateEnrollment: handleUpdateEnrollment,
         isBannerVisible,
         dismissBanner,
      }),
      [
         features,
         isEnrolled,
         getFeatureStage,
         handleUpdateEnrollment,
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

const FALLBACK: EarlyAccessContextValue = {
   features: [],
   isEnrolled: () => false,
   getFeatureStage: () => null,
   updateEnrollment: () => {},
   isBannerVisible: false,
   dismissBanner: () => {},
};

export function useEarlyAccess() {
   const ctx = useContext(EarlyAccessContext);
   return ctx ?? FALLBACK;
}
