import { Button } from "@packages/ui/components/button";
import {
   Collapsible,
   CollapsibleContent,
   CollapsibleTrigger,
} from "@packages/ui/components/collapsible";
import {
   type FeatureStage,
   FeatureStageBadge,
   FeatureStageChip,
} from "@packages/ui/components/feature-stage-badge";
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
import { Switch } from "@packages/ui/components/switch";
import { createFileRoute } from "@tanstack/react-router";
import {
   Bell,
   BellOff,
   Building2,
   ChevronDown,
   FileText,
   FlaskConical,
   Lightbulb,
   Users,
   Workflow,
} from "lucide-react";
import { createLocalStorageState } from "foxact/create-local-storage-state";
import { Fragment, useCallback, useState } from "react";
import { usePostHog } from "posthog-js/react";
import { useEarlyAccess } from "@/hooks/use-early-access";

const [useComingSoonNotifications] = createLocalStorageState<string[]>(
   "montte:coming-soon-notifications",
   [],
);

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/settings/feature-previews",
)({
   head: () => ({
      meta: [{ title: "Pré-visualizações — Montte" }],
   }),
   component: FeaturePreviewsPage,
});

const CONCEPT_CHILDREN: Record<string, string[]> = {};

const FEATURE_ICONS: Record<string, React.ElementType> = {};

type ComingSoonFeature = {
   flagKey: string;
   name: string;
   description: string;
   icon: React.ElementType;
};

type ComingSoonCategory = {
   id: string;
   label: string;
   icon: React.ElementType;
   features: ComingSoonFeature[];
};

const COMING_SOON_CATEGORIES: ComingSoonCategory[] = [
   {
      id: "crm",
      label: "CRM",
      icon: Users,
      features: [
         {
            flagKey: "pipeline-deals",
            name: "Pipeline de Deals",
            description:
               "Kanban de oportunidades com probabilidade e valor estimado via Twenty CRM.",
            icon: Workflow,
         },
      ],
   },
   {
      id: "coworking",
      label: "Coworking",
      icon: Building2,
      features: [
         {
            flagKey: "espacos-reservas",
            name: "Espaços & Reservas",
            description:
               "Catálogo de espaços e sistema de reservas via Cal.com.",
            icon: Building2,
         },
         {
            flagKey: "check-in-checkout",
            name: "Check-in / Check-out",
            description: "Log de entrada e saída de membros.",
            icon: Users,
         },
         {
            flagKey: "portal-membro",
            name: "Portal do Membro",
            description:
               "Self-service para reservas e visualização de faturas.",
            icon: Users,
         },
      ],
   },
   {
      id: "fiscal",
      label: "Fiscal",
      icon: FileText,
      features: [
         {
            flagKey: "nfse",
            name: "NFS-e",
            description:
               "Emissão de nota fiscal de serviço via APIs municipais.",
            icon: FileText,
         },
      ],
   },
];

function FeaturePreviewsPage() {
   const { features, isEnrolled, updateEnrollment } = useEarlyAccess();

   const [selectedStages, setSelectedStages] = useState<Set<FeatureStage>>(
      new Set(["concept", "alpha", "beta", "general-availability"]),
   );

   const toggleStage = (stage: FeatureStage) => {
      setSelectedStages((prev) => {
         const next = new Set(prev);
         if (next.has(stage)) {
            if (next.size === 1) return prev;
            next.delete(stage);
         } else {
            next.add(stage);
         }
         return next;
      });
   };

   const childNames = new Set(Object.values(CONCEPT_CHILDREN).flat());

   const parentFeatures = features.filter(
      (f) => f.flagKey !== null && !childNames.has(f.name),
   );
   const conceptFeatures = features.filter((f) => childNames.has(f.name));

   const conceptByName = new Map(conceptFeatures.map((f) => [f.name, f]));

   const filteredFeatures = parentFeatures.filter(
      (f) => f.stage !== null && selectedStages.has(f.stage),
   );

   const stageCounts = {
      concept: features.filter((f) => f.stage === "concept").length,
      alpha: features.filter((f) => f.stage === "alpha").length,
      beta: features.filter((f) => f.stage === "beta").length,
      "general-availability": features.filter(
         (f) => f.stage === "general-availability",
      ).length,
   };

   return (
      <div className="flex flex-col gap-4">
         <div>
            <h1 className="text-2xl font-semibold font-serif">
               Prévias de funcionalidades
            </h1>
            <p className="text-sm text-muted-foreground mt-3">
               As prévias permitem experimentar funcionalidades antes do
               lançamento oficial. Cada recurso passa por estágios de
               maturidade.
            </p>

            <div className="flex flex-col gap-2 mt-4">
               <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Filtrar por estágio:</span>
                  <Button
                     className="px-0"
                     onClick={() =>
                        setSelectedStages(
                           new Set([
                              "concept",
                              "alpha",
                              "beta",
                              "general-availability",
                           ]),
                        )
                     }
                     variant="link"
                  >
                     Mostrar todos
                  </Button>
               </div>
               <div className="flex flex-wrap gap-2">
                  <FeatureStageChip
                     count={stageCounts.concept}
                     isActive={selectedStages.has("concept")}
                     onClick={() => toggleStage("concept")}
                     stage="concept"
                  />
                  <FeatureStageChip
                     count={stageCounts.alpha}
                     isActive={selectedStages.has("alpha")}
                     onClick={() => toggleStage("alpha")}
                     stage="alpha"
                  />
                  <FeatureStageChip
                     count={stageCounts.beta}
                     isActive={selectedStages.has("beta")}
                     onClick={() => toggleStage("beta")}
                     stage="beta"
                  />
                  <FeatureStageChip
                     count={stageCounts["general-availability"]}
                     isActive={selectedStages.has("general-availability")}
                     onClick={() => toggleStage("general-availability")}
                     stage="general-availability"
                  />
               </div>
            </div>
         </div>

         {filteredFeatures.length === 0 && (
            <p className="text-sm text-muted-foreground">
               Nenhuma funcionalidade encontrada com os filtros selecionados.
            </p>
         )}

         {filteredFeatures.length > 0 && (
            <ItemGroup>
               {filteredFeatures.map((feature, index) => {
                  if (!feature.flagKey) return null;
                  const enrolled = isEnrolled(feature.flagKey);
                  const Icon = FEATURE_ICONS[feature.flagKey] ?? FlaskConical;

                  const featureChildNames =
                     CONCEPT_CHILDREN[feature.flagKey] ?? [];
                  const children = featureChildNames
                     .map((name) => conceptByName.get(name))
                     .filter(Boolean);
                  const hasChildren = children.length > 0;

                  return (
                     <Fragment key={feature.flagKey}>
                        {index > 0 && <ItemSeparator />}

                        <Collapsible
                           className="flex flex-col"
                           defaultOpen={true}
                        >
                           <Item variant="muted">
                              <ItemMedia variant="icon">
                                 <Icon className="size-4" />
                              </ItemMedia>
                              <ItemContent>
                                 <div className="flex items-center gap-2">
                                    <ItemTitle>{feature.name}</ItemTitle>
                                    {feature.stage && (
                                       <FeatureStageBadge
                                          className="text-xs"
                                          stage={feature.stage}
                                       />
                                    )}
                                 </div>
                                 <ItemDescription>
                                    {feature.description}
                                 </ItemDescription>
                              </ItemContent>
                              <ItemActions>
                                 <Switch
                                    checked={enrolled}
                                    onCheckedChange={(checked) => {
                                       updateEnrollment(
                                          feature.flagKey ?? "",
                                          checked,
                                       );
                                       if (!checked) {
                                          for (const child of children) {
                                             if (child?.flagKey) {
                                                updateEnrollment(
                                                   child.flagKey,
                                                   false,
                                                );
                                             }
                                          }
                                       }
                                    }}
                                 />
                                 {hasChildren && (
                                    <CollapsibleTrigger className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors [&[data-state=open]>svg]:rotate-180">
                                       <ChevronDown className="size-4 transition-transform duration-200" />
                                    </CollapsibleTrigger>
                                 )}
                              </ItemActions>
                           </Item>

                           {hasChildren && (
                              <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
                                 <ItemSeparator />
                                 <ItemGroup className="ml-10">
                                    {children.map((child, childIndex) => {
                                       const childEnrolled = child?.flagKey
                                          ? isEnrolled(child.flagKey)
                                          : false;
                                       return (
                                          <Fragment key={child?.name}>
                                             {childIndex > 0 && (
                                                <ItemSeparator />
                                             )}
                                             <Item variant="muted">
                                                <ItemMedia variant="icon">
                                                   <Lightbulb className="size-4 text-purple-500" />
                                                </ItemMedia>
                                                <ItemContent>
                                                   <div className="flex items-center gap-2">
                                                      <ItemTitle>
                                                         {child?.name}
                                                      </ItemTitle>
                                                      <FeatureStageBadge
                                                         className="text-xs"
                                                         stage="concept"
                                                      />
                                                   </div>
                                                   <ItemDescription>
                                                      {child?.description}
                                                   </ItemDescription>
                                                </ItemContent>
                                                {child?.flagKey && (
                                                   <ItemActions>
                                                      <Switch
                                                         checked={childEnrolled}
                                                         disabled={!enrolled}
                                                         onCheckedChange={(
                                                            checked,
                                                         ) =>
                                                            updateEnrollment(
                                                               child.flagKey ??
                                                                  "",
                                                               checked,
                                                            )
                                                         }
                                                      />
                                                   </ItemActions>
                                                )}
                                             </Item>
                                          </Fragment>
                                       );
                                    })}
                                 </ItemGroup>
                              </CollapsibleContent>
                           )}
                        </Collapsible>
                     </Fragment>
                  );
               })}
            </ItemGroup>
         )}

         <ComingSoonSection />
      </div>
   );
}

function ComingSoonSection() {
   const posthog = usePostHog();
   const [notified, setNotified] = useComingSoonNotifications();

   const isNotified = useCallback(
      (flagKey: string) => (notified ?? []).includes(flagKey),
      [notified],
   );

   const toggleNotification = useCallback(
      (flagKey: string) => {
         setNotified((prev) => {
            const keys = prev ?? [];
            const enrolled = !keys.includes(flagKey);
            posthog.people.set({ [`feature_interest_${flagKey}`]: enrolled });
            posthog.capture("feature_interest_updated", {
               feature_key: flagKey,
               enrolled,
            });
            return enrolled
               ? [...keys, flagKey]
               : keys.filter((k) => k !== flagKey);
         });
      },
      [posthog, setNotified],
   );

   return (
      <div className="flex flex-col gap-4">
         <div>
            <h2 className="text-base font-semibold">Em breve</h2>
            <p className="text-sm text-muted-foreground mt-2">
               Funcionalidades que estão sendo desenvolvidas. Inscreva-se para
               ser notificado quando estiverem disponíveis.
            </p>
         </div>

         <div className="flex flex-col gap-4">
            {COMING_SOON_CATEGORIES.map((category) => {
               const CategoryIcon = category.icon;
               return (
                  <div key={category.id} className="flex flex-col gap-2">
                     <div className="flex items-center gap-2">
                        <CategoryIcon className="size-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-muted-foreground">
                           {category.label}
                        </span>
                     </div>
                     <ItemGroup>
                        {category.features.map((feature, index) => {
                           const FeatureIcon = feature.icon;
                           const notifiedFlag = isNotified(feature.flagKey);
                           return (
                              <Fragment key={feature.flagKey}>
                                 {index > 0 && <ItemSeparator />}
                                 <Item variant="muted">
                                    <ItemMedia variant="icon">
                                       <FeatureIcon className="size-4" />
                                    </ItemMedia>
                                    <ItemContent>
                                       <ItemTitle>{feature.name}</ItemTitle>
                                       <ItemDescription>
                                          {feature.description}
                                       </ItemDescription>
                                    </ItemContent>
                                    <ItemActions>
                                       <Button
                                          onClick={() =>
                                             toggleNotification(feature.flagKey)
                                          }
                                          size="sm"
                                          variant={
                                             notifiedFlag
                                                ? "secondary"
                                                : "outline"
                                          }
                                       >
                                          {notifiedFlag ? (
                                             <>
                                                <BellOff className="size-4" />
                                                Inscrito
                                             </>
                                          ) : (
                                             <>
                                                <Bell className="size-4" />
                                                Ser notificado
                                             </>
                                          )}
                                       </Button>
                                    </ItemActions>
                                 </Item>
                              </Fragment>
                           );
                        })}
                     </ItemGroup>
                  </div>
               );
            })}
         </div>
      </div>
   );
}
