import { POSTHOG_SURVEYS } from "@core/posthog/config";
import { Button } from "@packages/ui/components/button";
import {
   Item,
   ItemActions,
   ItemContent,
   ItemDescription,
   ItemGroup,
   ItemMedia,
   ItemSeparator,
   ItemTitle,
} from "@packages/ui/components/item";
import { createFileRoute } from "@tanstack/react-router";
import { createLocalStorageState } from "foxact/create-local-storage-state";
import {
   BarChart3,
   Bell,
   BellOff,
   Building2,
   Plug,
   UsersRound,
} from "lucide-react";
import { usePostHog } from "posthog-js/react";
import { Fragment, useCallback } from "react";
import type * as React from "react";
import {
   FeatureStageBadge,
   type FeatureStage,
} from "@/components/blocks/feature-stage-badge";
import {
   EarlyAccessBanner,
   type EarlyAccessBannerTemplate,
} from "@/components/blocks/early-access-banner";
import { DefaultHeader } from "../../../-layout/default-header";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/settings/project/integrations",
)({
   head: () => ({
      meta: [{ title: "Integrações — Montte" }],
   }),
   component: ProjectIntegrationsPage,
});

const [useIntegrationInterest] = createLocalStorageState<string[]>(
   "montte:integration-interest",
   [],
);

type IntegrationDefinition = {
   key: string;
   name: string;
   description: string;
   details: string[];
   icon: React.ElementType;
   stage: FeatureStage;
};

const INTEGRATIONS: IntegrationDefinition[] = [
   {
      key: "twenty-crm",
      name: "Twenty CRM",
      description:
         "Conecte dados comerciais do Montte à ferramenta comercial de código aberto da sua empresa. A proposta é mapear clientes, empresas, oportunidades e objetos personalizados do Twenty antes de qualquer sincronização.",
      details: [
         "Mapeamento do modelo de dados",
         "Sincronização controlada e em lote",
         "Eventos externos e credenciais seguras em etapa futura",
      ],
      icon: UsersRound,
      stage: "concept",
   },
   {
      key: "posthog",
      name: "PostHog",
      description:
         "Planejamos expor uma configuração orientada para produto: eventos principais do Montte, controles de lançamento, acesso antecipado e pesquisas dentro do app para validar módulos antes de escalar.",
      details: [
         "Eventos de produto",
         "Controles de lançamento e acesso antecipado",
         "Pesquisas para descoberta com usuários",
      ],
      icon: BarChart3,
      stage: "concept",
   },
];

const INTEGRATIONS_BANNER: EarlyAccessBannerTemplate = {
   badgeLabel: "Integrações",
   message: "Estamos construindo nosso ecossistema de integrações.",
   ctaLabel: "Sugerir integração",
   stage: "concept",
   icon: Plug,
   surveyId: POSTHOG_SURVEYS.suggestIntegration.id,
   bullets: [
      "Quais meios de pagamento você utiliza?",
      "Há alguma plataforma de e-commerce ou marketplace que precisa se conectar?",
      "Qual integração desbloquearia mais valor na sua operação?",
   ],
};

function ProjectIntegrationsPage() {
   const posthog = usePostHog();
   const [interest, setInterest] = useIntegrationInterest();

   const isInterested = useCallback(
      (integrationKey: string) => (interest ?? []).includes(integrationKey),
      [interest],
   );

   const registerInterest = useCallback(
      (integration: IntegrationDefinition) => {
         const currentInterest = interest ?? [];
         if (currentInterest.includes(integration.key)) return;

         posthog.people.set({
            [`integration_interest_${integration.key}`]: true,
         });
         posthog.capture("integration_interest_updated", {
            integration_key: integration.key,
            enrolled: true,
         });
         setInterest([...currentInterest, integration.key]);
      },
      [interest, posthog, setInterest],
   );

   return (
      <div className="flex flex-col gap-4">
         <DefaultHeader
            description="Conecte ferramentas externas ao seu espaço e centralize sua operação."
            title="Integrações"
         />

         <EarlyAccessBanner template={INTEGRATIONS_BANNER} />

         <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
               <div className="flex items-center gap-2">
                  <Building2 className="size-4 text-muted-foreground" />
                  <h2 className="text-base font-semibold">
                     Integrações planejadas
                  </h2>
               </div>
               <p className="text-sm text-muted-foreground">
                  Estas integrações ainda estão em conceito. Registre interesse
                  para ajudar a priorizar o que deve entrar no planejamento.
               </p>
            </div>

            <ItemGroup>
               {INTEGRATIONS.map((integration, index) => {
                  const Icon = integration.icon;
                  const interested = isInterested(integration.key);

                  return (
                     <Fragment key={integration.key}>
                        {index > 0 && <ItemSeparator />}
                        <Item variant="muted">
                           <ItemMedia variant="icon">
                              <Icon className="size-4" />
                           </ItemMedia>
                           <ItemContent>
                              <ItemTitle>
                                 {integration.name}
                                 <FeatureStageBadge
                                    className="text-xs"
                                    stage={integration.stage}
                                 />
                              </ItemTitle>
                              <ItemDescription>
                                 {integration.description}
                              </ItemDescription>
                              <div className="flex flex-wrap gap-2">
                                 {integration.details.map((detail) => (
                                    <span
                                       className="rounded-md border border-border bg-background p-2 text-xs text-muted-foreground"
                                       key={detail}
                                    >
                                       {detail}
                                    </span>
                                 ))}
                              </div>
                           </ItemContent>
                           <ItemActions className="shrink-0">
                              <Button
                                 disabled={interested}
                                 onClick={() => registerInterest(integration)}
                                 size="sm"
                                 variant={interested ? "secondary" : "outline"}
                              >
                                 {interested ? (
                                    <>
                                       <BellOff className="size-4" />
                                       Interesse registrado
                                    </>
                                 ) : (
                                    <>
                                       <Bell className="size-4" />
                                       Tenho interesse
                                    </>
                                 )}
                              </Button>
                           </ItemActions>
                        </Item>
                     </Fragment>
                  );
               })}
            </ItemGroup>
         </section>
      </div>
   );
}
