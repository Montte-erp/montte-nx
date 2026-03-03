import { format, fromMinorUnits, of } from "@f-o-t/money";
import { AddonName, FREE_TIER_LIMITS } from "@packages/stripe/constants";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   Card,
   CardAction,
   CardContent,
   CardDescription,
   CardHeader,
   CardTitle,
} from "@packages/ui/components/card";
import {
   Collapsible,
   CollapsibleContent,
   CollapsibleTrigger,
} from "@packages/ui/components/collapsible";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import type { FeatureStage } from "@packages/ui/components/feature-stage-badge";
import { FeatureStageBadge } from "@packages/ui/components/feature-stage-badge";
import { Progress } from "@packages/ui/components/progress";
import { Skeleton } from "@packages/ui/components/skeleton";
import {
   Tooltip,
   TooltipContent,
   TooltipProvider,
   TooltipTrigger,
} from "@packages/ui/components/tooltip";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import {
   Briefcase,
   Building2,
   Calendar,
   Check,
   ChevronRight,
   Coins,
   CreditCard,
   ExternalLink,
   FileCheck,
   FileText,
   HelpCircle,
   Package,
   Receipt,
   Sparkles,
   TrendingUp,
   Users,
   Webhook,
   Zap,
} from "lucide-react";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useEarlyAccess } from "@/hooks/use-early-access";
import { orpc } from "@/integrations/orpc/client";

// ============================================
// Types
// ============================================

interface CategorySummary {
   category: string;
   eventCount: number;
   monthToDateCost: number;
   projectedCost: number;
}

interface EventUsage {
   eventName: string;
   eventCount: number;
   monthToDateCost: number;
   displayName: string;
   description: string | null;
   pricePerEvent: number | null;
   freeTierLimit: number;
}

// ============================================
// Constants
// ============================================

const CATEGORY_CONFIG: Record<
   string,
   { label: string; description: string; icon: ReactNode }
> = {
   finance: {
      label: "Financeiro",
      description: "Transacoes financeiras, contas bancarias e categorias",
      icon: <Coins className="size-5" />,
   },
   ai: {
      label: "Inteligencia Artificial",
      description: "Mensagens de chat IA e acoes de agentes",
      icon: <Sparkles className="size-5" />,
   },
   contact: {
      label: "Contatos",
      description: "Cadastro de pessoas e empresas",
      icon: <Users className="size-5" />,
   },
   inventory: {
      label: "Estoque",
      description: "Produtos, materiais e controle de estoque",
      icon: <Package className="size-5" />,
   },
   service: {
      label: "Servicos",
      description: "Prestacao de servicos e ordens de servico",
      icon: <Briefcase className="size-5" />,
   },
   nfe: {
      label: "NF-e",
      description: "Emissao e cancelamento de notas fiscais eletronicas",
      icon: <FileText className="size-5" />,
   },
   document: {
      label: "Assinatura Digital",
      description: "Assinaturas eletrônicas de documentos",
      icon: <FileCheck className="size-5" />,
   },
   webhook: {
      label: "Webhooks",
      description: "Entregas de webhook e notificacoes externas",
      icon: <Webhook className="size-5" />,
   },
};

// ---------------------------------------------------------------------------
// Early Access Gating
// ---------------------------------------------------------------------------

// Event-based categories gated by early access flag.
// To add a new gated category: add one entry here (flag key + fallback stage).
// The category must also exist in CATEGORY_CONFIG above.
const EARLY_ACCESS_CATEGORY_GATES: Record<
   string,
   { flag: string; fallbackStage: FeatureStage }
> = {
   nfe: { flag: "nfe", fallbackStage: "alpha" },
   document: { flag: "document-signing", fallbackStage: "alpha" },
};

// ============================================
// Helpers
// ============================================

function getCategoryFreeTier(category: string): number {
   return Object.entries(FREE_TIER_LIMITS)
      .filter(([key]) => key.startsWith(`${category}.`))
      .reduce((sum, [, limit]) => sum + limit, 0);
}

function formatCurrency(value: number): string {
   return format(of(String(value), "BRL"), "pt-BR");
}

function getBillingPeriodDates(): { start: Date; end: Date } {
   const now = new Date();
   const start = new Date(now.getFullYear(), now.getMonth(), 1);
   const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
   return { start, end };
}

function formatPeriodDate(d: Date): string {
   return d.toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "long",
      year: "numeric",
   });
}

function getDaysRemaining(): number {
   const now = new Date();
   const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
   return Math.max(
      0,
      Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
   );
}

// ============================================
// Current Bill Header
// ============================================

function CurrentBillHeader({ monthToDate }: { monthToDate: number }) {
   return (
      <div>
         <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-muted-foreground">
               Total do mes
            </span>
            <TooltipProvider>
               <Tooltip>
                  <TooltipTrigger>
                     <HelpCircle className="size-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                     <p>
                        Total acumulado baseado no uso de eventos neste periodo
                        de cobranca.
                     </p>
                  </TooltipContent>
               </Tooltip>
            </TooltipProvider>
         </div>
         <p className="text-4xl font-bold tracking-tight tabular-nums">
            {formatCurrency(monthToDate)}
         </p>
      </div>
   );
}

// ============================================
// Plan Banner
// ============================================

function PlanBanner({ addonName }: { addonName: string | null }) {
   const { slug, teamSlug } = useParams({
      from: "/_authenticated/$slug/$teamSlug/_dashboard",
   });

   const addonLabel = addonName
      ? addonName.charAt(0).toUpperCase() + addonName.slice(1)
      : null;

   return (
      <div className="rounded-lg bg-card border p-5 flex items-start justify-between gap-4">
         <div className="space-y-1.5">
            <div className="flex items-center gap-2">
               <Zap className="size-5 text-primary" />
               <p className="font-semibold text-lg">
                  {addonLabel ? `Addon ${addonLabel} ativo` : "Pay as you go"}
               </p>
            </div>
            <p className="text-sm text-muted-foreground">
               Cada funcionalidade é cobrada por uso. Limites gratuitos mensais
               incluídos — pague apenas pelo excedente.
            </p>
         </div>
         <Button asChild variant="outline">
            <Link params={{ slug, teamSlug }} to="/$slug/$teamSlug/plans">
               Ver addons
            </Link>
         </Button>
      </div>
   );
}

// ============================================
// Billing Period + Payment Link
// ============================================

function BillingPeriodSection() {
   const { start, end } = getBillingPeriodDates();
   const daysRemaining = getDaysRemaining();

   return (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
         <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="size-4" />
            <span>
               Periodo de cobranca:{" "}
               <span className="font-medium text-foreground">
                  {formatPeriodDate(start)}
               </span>{" "}
               a{" "}
               <span className="font-medium text-foreground">
                  {formatPeriodDate(end)}
               </span>{" "}
               ({daysRemaining}{" "}
               {daysRemaining === 1 ? "dia restante" : "dias restantes"})
            </span>
         </div>
      </div>
   );
}

// ============================================
// Product Card (PostHog-style)
// ============================================

function OverviewProductCardSkeleton() {
   return (
      <div className="space-y-3 pt-4">
         <Skeleton className="h-6 w-full" />
         <Skeleton className="h-6 w-full" />
         <Skeleton className="h-6 w-full" />
      </div>
   );
}

function OverviewProductSubItems({ category }: { category: string }) {
   const { data: events, isLoading } = useQuery(
      orpc.billing.getCategoryUsage.queryOptions({
         input: {
            category: category as
               | "finance"
               | "ai"
               | "webhook"
               | "dashboard"
               | "insight"
               | "contact"
               | "inventory"
               | "service"
               | "nfe"
               | "document"
               | "system",
         },
      }),
   );

   if (isLoading) {
      return <OverviewProductCardSkeleton />;
   }

   if (!events || events.length === 0) {
      return (
         <p className="text-sm text-muted-foreground py-3">
            Nenhum evento registrado nesta categoria
         </p>
      );
   }

   return (
      <div className="space-y-3 pt-4">
         {events.map((event: EventUsage) => {
            const hasLimit = event.freeTierLimit > 0;
            const percentage = hasLimit
               ? Math.min((event.eventCount / event.freeTierLimit) * 100, 100)
               : undefined;

            return (
               <div className="space-y-1.5" key={event.eventName}>
                  <div className="flex items-center justify-between text-sm">
                     <span>{event.displayName}</span>
                     <div className="flex items-center gap-4">
                        <span className="tabular-nums text-muted-foreground">
                           {event.eventCount.toLocaleString("pt-BR")}
                           {hasLimit && (
                              <span>
                                 {" "}
                                 / {event.freeTierLimit.toLocaleString("pt-BR")}
                              </span>
                           )}
                        </span>
                        <span className="tabular-nums font-medium w-20 text-right">
                           {formatCurrency(event.monthToDateCost)}
                        </span>
                     </div>
                  </div>
                  {percentage !== undefined && (
                     <Progress className="h-1" value={percentage} />
                  )}
               </div>
            );
         })}
      </div>
   );
}

function OverviewProductCard({
   category,
   stage,
   enrolled = true,
}: {
   category: CategorySummary;
   stage?: FeatureStage;
   enrolled?: boolean;
}) {
   const { slug, teamSlug } = useParams({
      from: "/_authenticated/$slug/$teamSlug/_dashboard",
   });
   const config = CATEGORY_CONFIG[category.category];
   if (!config) return null;

   return (
      <Card className={!enrolled ? "opacity-70" : ""}>
         <Collapsible>
            <CardHeader className="pb-3">
               <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                     <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground shrink-0">
                        {config.icon}
                     </div>
                     <div className="min-w-0">
                        <CardTitle className="text-base">
                           {config.label}
                        </CardTitle>
                        <CardDescription className="text-xs mt-0.5">
                           {config.description}
                        </CardDescription>
                     </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                     {stage && <FeatureStageBadge stage={stage} />}
                     {!enrolled && (
                        <Button asChild variant="outline">
                           <Link
                              params={{ slug, teamSlug }}
                              to="/$slug/$teamSlug/settings/feature-previews"
                           >
                              Ativar
                           </Link>
                        </Button>
                     )}
                  </div>
               </div>
            </CardHeader>

            {enrolled && (
               <CardContent className="space-y-4">
                  {/* Usage bar + stats row */}
                  <div className="flex items-center gap-4">
                     <CollapsibleTrigger className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors shrink-0">
                        <ChevronRight className="size-4 transition-transform [[data-state=open]_&]:rotate-90" />
                     </CollapsibleTrigger>

                     <div className="flex-1 flex items-center gap-6">
                        {/* Current usage */}
                        <div className="text-sm shrink-0">
                           <span className="text-muted-foreground">Atual</span>
                           <p className="font-medium tabular-nums">
                              {category.eventCount.toLocaleString("pt-BR")}
                           </p>
                        </div>

                        {/* Progress bar + free tier label */}
                        {(() => {
                           const freeTier = getCategoryFreeTier(
                              category.category,
                           );
                           return (
                              <div className="flex-1 space-y-1 min-w-0">
                                 <Progress
                                    className="h-2"
                                    value={
                                       freeTier > 0
                                          ? Math.min(
                                             (category.eventCount /
                                                freeTier) *
                                             100,
                                             100,
                                          )
                                          : 0
                                    }
                                 />
                                 {freeTier > 0 && (
                                    <p className="text-xs text-muted-foreground">
                                       Limite gratuito:{" "}
                                       {freeTier.toLocaleString("pt-BR")}
                                    </p>
                                 )}
                              </div>
                           );
                        })()}

                        {/* Costs */}
                        <div className="flex items-center gap-6 shrink-0">
                           <div className="text-right">
                              <span className="text-lg font-semibold tabular-nums">
                                 {formatCurrency(category.monthToDateCost)}
                              </span>
                              <p className="text-xs text-muted-foreground">
                                 No mes
                              </p>
                           </div>
                           <div className="text-right">
                              <span className="text-lg font-semibold tabular-nums">
                                 {formatCurrency(category.projectedCost)}
                              </span>
                              <p className="text-xs text-muted-foreground">
                                 Projetado
                              </p>
                           </div>
                        </div>
                     </div>
                  </div>

                  {/* Expandable sub-items */}
                  <CollapsibleContent>
                     <div className="border-t">
                        <ErrorBoundary
                           fallback={
                              <p className="text-sm text-destructive py-3">
                                 Erro ao carregar detalhes
                              </p>
                           }
                        >
                           <Suspense fallback={<OverviewProductCardSkeleton />}>
                              <OverviewProductSubItems
                                 category={category.category}
                              />
                           </Suspense>
                        </ErrorBoundary>
                     </div>
                  </CollapsibleContent>
               </CardContent>
            )}
         </Collapsible>
      </Card>
   );
}

interface AddonDef {
   name: AddonName;
   displayName: string;
   description: string;
   price: string;
   perUnit: string;
   features: string[];
   icon: ReactNode;
}

const ADDON_DEFS: AddonDef[] = [
   {
      name: AddonName.BOOST,
      displayName: "Boost",
      description: "Limites ampliados para equipes em crescimento",
      price: "R$ 199",
      perUnit: "/mês",
      features: [
         "Limites 5× maiores em todos os módulos",
         "Suporte prioritário",
         "Acesso antecipado a novas funcionalidades",
      ],
      icon: <Zap className="size-4" />,
   },
   {
      name: AddonName.SCALE,
      displayName: "Scale",
      description: "Para operações de grande volume",
      price: "R$ 599",
      perUnit: "/mês",
      features: [
         "Limites 20× maiores em todos os módulos",
         "SLA de suporte dedicado",
         "Integrações avançadas",
      ],
      icon: <TrendingUp className="size-4" />,
   },
   {
      name: AddonName.ENTERPRISE,
      displayName: "Enterprise",
      description: "Infraestrutura dedicada e customizações sob medida",
      price: "R$ 2.500+",
      perUnit: "/mês",
      features: [
         "Limites ilimitados",
         "Deploy dedicado",
         "Customizações sob medida",
         "Suporte 24/7",
      ],
      icon: <Building2 className="size-4" />,
   },
];

function AddonCard({ addon, active }: { addon: AddonDef; active: boolean }) {
   return (
      <Card className={active ? "border-primary/60" : ""}>
         <CardHeader>
            <CardTitle className="flex gap-2 items-center">
               <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-primary ">
                  {addon.icon}
               </div>
               <span>{addon.displayName} addon</span>
            </CardTitle>
            <CardDescription> {addon.description}</CardDescription>
            <CardAction className="flex gap-2 items-center">
               {active ? (
                  <span className="text-sm text-primary font-medium">
                     Ativo
                  </span>
               ) : (
                  <span className="text-sm text-muted-foreground tabular-nums">
                     {addon.price}
                     <span className="text-xs">{addon.perUnit}</span>
                  </span>
               )}
               <Button variant={active ? "outline" : "default"}>
                  {active ? "Gerenciar" : "Contratar"}
               </Button>
            </CardAction>
         </CardHeader>
         <CardContent className=" space-y-4">
            {/* Features */}
            <p className="text-xs text-muted-foreground">Recursos incluídos:</p>
            <div className="grid gap-4  md:grid-cols-2">
               {addon.features.map((feature) => (
                  <div className="flex items-center gap-2" key={feature}>
                     <Check className="size-4 text-primary " />
                     <span className="text-sm font-medium">{feature}</span>
                  </div>
               ))}
            </div>
         </CardContent>
      </Card>
   );
}

// ============================================
// Invoices Section (compact)
// ============================================

function InvoicesPreviewSkeleton() {
   return (
      <div className="space-y-2">
         <Skeleton className="h-10 w-full" />
         <Skeleton className="h-10 w-full" />
         <Skeleton className="h-10 w-full" />
      </div>
   );
}

function InvoicesPreviewContent() {
   const { data: invoices } = useSuspenseQuery(
      orpc.billing.getInvoices.queryOptions({ limit: 5 }),
   );

   if (!invoices || invoices.length === 0) {
      return (
         <Empty className="border-none py-4">
            <EmptyHeader>
               <EmptyMedia variant="icon">
                  <Receipt className="size-5" />
               </EmptyMedia>
               <EmptyTitle className="text-sm">
                  Nenhuma fatura encontrada
               </EmptyTitle>
               <EmptyDescription className="text-xs">
                  Suas faturas aparecerão aqui apos o primeiro pagamento
               </EmptyDescription>
            </EmptyHeader>
         </Empty>
      );
   }

   return (
      <div className="space-y-1">
         {invoices.map((invoice) => {
            const date =
               typeof invoice.created === "number"
                  ? new Date(invoice.created * 1000)
                  : new Date(invoice.created);
            const formattedDate = date.toLocaleDateString("pt-BR", {
               day: "2-digit",
               month: "2-digit",
               year: "numeric",
            });
            const amount = format(
               fromMinorUnits(
                  invoice.amountPaid,
                  invoice.currency.toUpperCase(),
               ),
               "pt-BR",
            );

            const statusLabel =
               invoice.status === "paid"
                  ? "Pago"
                  : invoice.status === "open"
                     ? "Aberto"
                     : (invoice.status ?? "—");

            return (
               <div
                  className="flex items-center justify-between py-2 px-1 text-sm hover:bg-muted/50 rounded-md transition-colors"
                  key={invoice.id}
               >
                  <div className="flex items-center gap-3 min-w-0">
                     <span className="text-muted-foreground tabular-nums">
                        {formattedDate}
                     </span>
                     <span className="truncate font-medium">
                        {invoice.number || `#${invoice.id.slice(0, 8)}`}
                     </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                     <Badge
                        className={
                           invoice.status === "paid"
                              ? "bg-primary/10 text-primary border-primary/20"
                              : ""
                        }
                        variant={
                           invoice.status === "paid" ? "secondary" : "outline"
                        }
                     >
                        {statusLabel}
                     </Badge>
                     <span className="font-medium tabular-nums">{amount}</span>
                     {invoice.invoicePdf && (
                        <a
                           className="text-muted-foreground hover:text-foreground transition-colors"
                           href={invoice.invoicePdf}
                           rel="noopener noreferrer"
                           target="_blank"
                        >
                           <ExternalLink className="size-3.5" />
                        </a>
                     )}
                  </div>
               </div>
            );
         })}
      </div>
   );
}

// ============================================
// BillingOverview (main export)
// ============================================

export function BillingOverview() {
   const { slug, teamSlug } = useParams({
      from: "/_authenticated/$slug/$teamSlug/_dashboard",
   });
   const { data } = useSuspenseQuery(
      orpc.billing.getCurrentUsage.queryOptions({}),
   );
   const { activeSubscription } = useActiveOrganization();
   const { features, isEnrolled } = useEarlyAccess();

   const activeAddonName = activeSubscription
      ? (activeSubscription.plan as string).toLowerCase()
      : null;

   // Derive stage from PostHog feature config, fall back to local config.
   function resolveStage(
      flagKey: string,
      fallback: FeatureStage,
   ): FeatureStage {
      const posthogStage = features.find((f) => f.flagKey === flagKey)?.stage as
         | FeatureStage
         | undefined;
      return posthogStage ?? fallback;
   }

   // Show all categories — gated ones appear with an enroll CTA when not enrolled.
   const visibleCategories = Object.keys(CATEGORY_CONFIG);

   // Merge API data with known categories — always show all visible cards.
   const categoryDataMap = new Map(data.byCategory.map((c) => [c.category, c]));

   const allCategories: CategorySummary[] = visibleCategories.map((cat) => {
      const existing = categoryDataMap.get(cat);
      return (
         existing ?? {
            category: cat,
            eventCount: 0,
            monthToDateCost: 0,
            projectedCost: 0,
         }
      );
   });

   const sortedCategories = allCategories.sort(
      (a, b) => b.monthToDateCost - a.monthToDateCost,
   );

   return (
      <div className="space-y-6">
         {/* Top section: bill total + plan banner */}
         <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <CurrentBillHeader monthToDate={data.monthToDate} />
            <div className="lg:max-w-md flex-1">
               <PlanBanner addonName={activeAddonName} />
            </div>
         </div>

         {/* Billing period */}
         <BillingPeriodSection />

         {/* Manage card link */}
         <Button asChild variant="outline">
            <Link params={{ slug, teamSlug }} to="/$slug/$teamSlug/plans">
               <CreditCard className="size-4 mr-1.5" />
               Gerenciar plano e faturas
               <ExternalLink className="size-3 ml-1" />
            </Link>
         </Button>

         <div>
            <h2 className="text-lg font-semibold mb-4">Addons</h2>
            <div className="space-y-4">
               {ADDON_DEFS.map((addon) => (
                  <AddonCard
                     active={activeAddonName === addon.name}
                     addon={addon}
                     key={addon.name}
                  />
               ))}
            </div>
         </div>

         {/* Products section */}
         <div>
            <h2 className="text-lg font-semibold mb-4">Produtos</h2>
            <div className="space-y-4">
               {sortedCategories.map((cat) => {
                  const gate = EARLY_ACCESS_CATEGORY_GATES[cat.category];
                  const stage = gate
                     ? resolveStage(gate.flag, gate.fallbackStage)
                     : undefined;
                  const enrolled = gate ? isEnrolled(gate.flag) : true;
                  return (
                     <OverviewProductCard
                        category={cat}
                        enrolled={enrolled}
                        key={cat.category}
                        stage={stage}
                     />
                  );
               })}
            </div>
         </div>

         {/* Recent invoices */}
         <Card>
            <CardHeader>
               <CardTitle className="text-base">Faturas recentes</CardTitle>
               <CardDescription>Ultimas cobranças e pagamentos</CardDescription>
            </CardHeader>
            <CardContent>
               <ErrorBoundary
                  fallback={
                     <p className="text-sm text-destructive">
                        Erro ao carregar faturas
                     </p>
                  }
               >
                  <Suspense fallback={<InvoicesPreviewSkeleton />}>
                     <InvoicesPreviewContent />
                  </Suspense>
               </ErrorBoundary>
            </CardContent>
         </Card>
      </div>
   );
}
