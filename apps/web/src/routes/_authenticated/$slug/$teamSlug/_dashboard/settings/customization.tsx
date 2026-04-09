import { Card, CardContent } from "@packages/ui/components/card";
import { createErrorFallback } from "@/components/query-boundary";
import {
   Item,
   ItemActions,
   ItemContent,
   ItemDescription,
   ItemGroup,
   ItemMedia,
   ItemTitle,
} from "@packages/ui/components/item";
import { Skeleton } from "@packages/ui/components/skeleton";
import { Switch } from "@packages/ui/components/switch";
import { createFileRoute } from "@tanstack/react-router";
import { useIsomorphicLayoutEffect } from "foxact/use-isomorphic-layout-effect";
import { Activity, Moon } from "lucide-react";
import { usePostHog } from "posthog-js/react";
import { useCallback, useState } from "react";
import type { FallbackProps } from "react-error-boundary";
import { ThemeSwitcher } from "@/layout/dashboard/ui/theme-switcher";
import { QueryBoundary } from "@/components/query-boundary";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/settings/customization",
)({
   head: () => ({
      meta: [{ title: "Personalização — Montte" }],
   }),
   component: PreferencesPage,
});

function PreferencesSectionSkeleton() {
   return (
      <div className="space-y-6">
         <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-72 mt-2" />
         </div>
         <div className="space-y-1">
            <Skeleton className="h-16 w-full rounded-lg" />
         </div>
         <div className="space-y-1">
            <Skeleton className="h-16 w-full rounded-lg" />
         </div>
      </div>
   );
}

function PreferencesSectionErrorFallback(props: FallbackProps) {
   return (
      <div className="space-y-6">
         <div>
            <h1 className="text-2xl font-semibold font-serif">
               Personalização
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
               Personalize sua experiência no aplicativo.
            </p>
         </div>
         <Card>
            <CardContent className="py-8">
               {createErrorFallback({
                  errorDescription:
                     "Não foi possível carregar suas preferências",
                  errorTitle: "Erro ao Carregar",
                  retryText: "Tentar novamente",
               })(props)}
            </CardContent>
         </Card>
      </div>
   );
}

// ============================================
// Content Creation Card Component (Pro only)
// ============================================

// ============================================
// Appearance Card Component
// ============================================

function AppearanceSection() {
   return (
      <section className="space-y-3">
         <div>
            <h2 className="text-lg font-medium">Aparência</h2>
            <p className="text-sm text-muted-foreground mt-1">
               Personalize a aparência da interface
            </p>
         </div>
         <ItemGroup>
            <Item variant="muted">
               <ItemMedia variant="icon">
                  <Moon className="size-4" />
               </ItemMedia>
               <ItemContent className="min-w-0">
                  <ItemTitle>Tema</ItemTitle>
                  <ItemDescription className="line-clamp-2">
                     Escolha o tema da interface
                  </ItemDescription>
               </ItemContent>
               <ItemActions>
                  <ThemeSwitcher />
               </ItemActions>
            </Item>
         </ItemGroup>
      </section>
   );
}

// ============================================
// Privacy Section Component
// ============================================

function PrivacySection({
   hasConsent,
   onConsentChange,
}: {
   hasConsent: boolean;
   onConsentChange: (consent: boolean) => void;
}) {
   return (
      <section className="space-y-3">
         <div>
            <h2 className="text-lg font-medium">Privacidade</h2>
            <p className="text-sm text-muted-foreground mt-1">
               Controle como seus dados são utilizados
            </p>
         </div>
         <ItemGroup>
            <Item variant="muted">
               <ItemMedia variant="icon">
                  <Activity className="size-4" />
               </ItemMedia>
               <ItemContent className="min-w-0">
                  <ItemTitle>Telemetria</ItemTitle>
                  <ItemDescription className="line-clamp-2">
                     Ajude-nos a melhorar compartilhando dados de uso anônimos
                  </ItemDescription>
               </ItemContent>
               <ItemActions>
                  <Switch
                     aria-label="Telemetria"
                     checked={hasConsent}
                     onCheckedChange={onConsentChange}
                  />
               </ItemActions>
            </Item>
         </ItemGroup>
      </section>
   );
}

// ============================================
// Main Content Component
// ============================================

function PreferencesSectionContent() {
   const posthog = usePostHog();
   const [hasConsent, setHasConsent] = useState(true);

   useIsomorphicLayoutEffect(() => {
      setHasConsent(!posthog.has_opted_out_capturing());
   }, [posthog]);

   const handleConsentChange = useCallback(
      (checked: boolean) => {
         if (checked) {
            posthog.opt_in_capturing();
         } else {
            posthog.opt_out_capturing();
         }
         setHasConsent(checked);
      },
      [posthog],
   );

   return (
      <div className="space-y-6">
         <div>
            <h1 className="text-2xl font-semibold font-serif">
               Personalização
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
               Personalize sua experiência no aplicativo.
            </p>
         </div>

         <AppearanceSection />

         <PrivacySection
            hasConsent={hasConsent}
            onConsentChange={handleConsentChange}
         />
      </div>
   );
}

function PreferencesPage() {
   return (
      <QueryBoundary
         fallback={<PreferencesSectionSkeleton />}
         errorFallback={PreferencesSectionErrorFallback}
      >
         <PreferencesSectionContent />
      </QueryBoundary>
   );
}
