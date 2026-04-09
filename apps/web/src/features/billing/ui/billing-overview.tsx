import { format, fromMinorUnits, of } from "@f-o-t/money";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   Card,
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
import { Progress } from "@packages/ui/components/progress";
import { Skeleton } from "@packages/ui/components/skeleton";
import { Spinner } from "@packages/ui/components/spinner";
import {
   Tooltip,
   TooltipContent,
   TooltipProvider,
   TooltipTrigger,
} from "@packages/ui/components/tooltip";
import { useSuspenseQueries, useSuspenseQuery } from "@tanstack/react-query";
import {
   Briefcase,
   Calendar,
   ChevronRight,
   Coins,
   CreditCard,
   ExternalLink,
   HelpCircle,
   Package,
   Receipt,
   Users,
   Webhook,
} from "lucide-react";
import type { ReactNode } from "react";
import { Suspense, useTransition } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { toast } from "sonner";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { authClient } from "@/integrations/better-auth/auth-client";
import { orpc } from "@/integrations/orpc/client";
import type { Outputs } from "@/integrations/orpc/client";

type MeterUsageItem = Outputs["billing"]["getMeterUsage"][number];
type CatalogEntry = Outputs["billing"]["getEventCatalog"][number];

interface EventWithUsage {
   eventName: string;
   displayName: string;
   used: number;
   freeTierLimit: number;
   pricePerEvent: string;
}

interface CategorySummary {
   category: string;
   eventCount: number;
   monthToDateCost: number;
   projectedCost: number;
   events: EventWithUsage[];
}

const CATEGORY_ICONS: Record<string, ReactNode> = {
   finance: <Coins className="size-5" />,
   contact: <Users className="size-5" />,
   inventory: <Package className="size-5" />,
   service: <Briefcase className="size-5" />,
   webhook: <Webhook className="size-5" />,
};

const PLATFORM_ADDONS = [
   {
      id: "boost",
      label: "Boost",
      price: "R$199/mês",
      description: "SSO, white label, 2FA enforcement e espaços ilimitados",
      features: ["SSO", "White label", "2FA enforcement", "Espaços ilimitados"],
   },
   {
      id: "scale",
      label: "Scale",
      price: "R$599/mês",
      description: "Tudo do Boost + SAML, RBAC, audit logs e SLA 24h",
      features: ["SAML", "RBAC", "Audit logs", "SLA 24h"],
   },
   {
      id: "enterprise",
      label: "Enterprise",
      price: "R$2.500+/mês",
      description: "Tudo do Scale + múltiplos CNPJs, SLA 4h e suporte dedicado",
      features: ["Múltiplos CNPJs", "SLA 4h", "Suporte dedicado"],
   },
] as const;

function computeMonthlyCost(item: EventWithUsage): number {
   const overage = Math.max(0, item.used - item.freeTierLimit);
   return overage * parseFloat(item.pricePerEvent);
}

function computeProjectedCost(monthToDateCost: number): number {
   const now = new Date();
   const dayOfMonth = now.getDate();
   const daysInMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
   ).getDate();
   if (dayOfMonth <= 0) return monthToDateCost;
   return (monthToDateCost / dayOfMonth) * daysInMonth;
}

function buildCategorySummaries(
   catalog: CatalogEntry[],
   meterUsage: MeterUsageItem[],
): CategorySummary[] {
   const usageMap = new Map(meterUsage.map((m) => [m.eventName, m.used]));
   const billable = catalog.filter((e) => e.isBillable);
   const byCategory = new Map<string, EventWithUsage[]>();

   for (const entry of billable) {
      const used = usageMap.get(entry.eventName) ?? 0;
      const existing = byCategory.get(entry.category) ?? [];
      existing.push({
         eventName: entry.eventName,
         displayName: entry.displayName,
         used,
         freeTierLimit: entry.freeTierLimit,
         pricePerEvent: entry.pricePerEvent,
      });
      byCategory.set(entry.category, existing);
   }

   const summaries: CategorySummary[] = [];
   for (const [category, events] of byCategory) {
      const eventCount = events.reduce((sum, e) => sum + e.used, 0);
      const monthToDateCost = events.reduce(
         (sum, e) => sum + computeMonthlyCost(e),
         0,
      );
      summaries.push({
         category,
         eventCount,
         monthToDateCost,
         projectedCost: computeProjectedCost(monthToDateCost),
         events,
      });
   }

   return summaries;
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

function AddCardBanner({ hasPaymentMethod }: { hasPaymentMethod: boolean }) {
   const { activeOrganization } = useActiveOrganization();
   const [isPending, startTransition] = useTransition();

   const handleAddCard = () => {
      startTransition(async () => {
         const result = await authClient.subscription.billingPortal({
            referenceId: activeOrganization?.id,
            returnUrl: window.location.href,
         });
         if (result.error) {
            toast.error(result.error.message ?? "Erro ao abrir portal");
            return;
         }
         if (result.data?.url) {
            window.location.href = result.data.url;
         }
      });
   };

   if (hasPaymentMethod) return null;

   return (
      <div className="rounded-lg border border-dashed bg-muted/40 p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
         <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background border">
               <CreditCard className="size-4 text-muted-foreground" />
            </div>
            <div className="space-y-0.5">
               <p className="font-medium text-sm">
                  Adicione um cartão para ativar o pay as you go
               </p>
               <p className="text-xs text-muted-foreground">
                  Sem cartão, o uso é limitado ao tier gratuito mensal. Adicione
                  um cartão para pagar apenas pelo que exceder.
               </p>
            </div>
         </div>
         <Button
            className="shrink-0"
            disabled={isPending}
            onClick={handleAddCard}
            variant="default"
         >
            {isPending ? (
               <Spinner className="size-4" />
            ) : (
               <CreditCard className="size-4" />
            )}
            Adicionar cartão
         </Button>
      </div>
   );
}

type ActiveAddon = { addonId: string };

function AddonCard({
   addon,
   isActive,
   hasPaymentMethod,
   onSubscribe,
   isPending,
}: {
   addon: (typeof PLATFORM_ADDONS)[number];
   isActive: boolean;
   hasPaymentMethod: boolean;
   onSubscribe: (addonId: string) => void;
   isPending: boolean;
}) {
   return (
      <Card className={!hasPaymentMethod ? "opacity-70" : ""}>
         <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4">
               <div className="min-w-0">
                  <div className="flex items-center gap-2">
                     <CardTitle className="text-base">{addon.label}</CardTitle>
                     {isActive && (
                        <Badge
                           className="bg-primary/10 text-primary border-primary/20"
                           variant="secondary"
                        >
                           Ativo
                        </Badge>
                     )}
                  </div>
                  <CardDescription className="text-xs mt-0.5">
                     {addon.description}
                  </CardDescription>
               </div>
               <div className="shrink-0 text-right">
                  <p className="font-semibold text-sm">{addon.price}</p>
               </div>
            </div>
         </CardHeader>
         <CardContent className="pt-0">
            <div className="flex items-center justify-between gap-4">
               <div className="flex flex-wrap gap-1">
                  {addon.features.map((feature) => (
                     <Badge
                        className="text-xs font-normal"
                        key={feature}
                        variant="outline"
                     >
                        {feature}
                     </Badge>
                  ))}
               </div>
               {!isActive && (
                  <TooltipProvider>
                     <Tooltip>
                        <TooltipTrigger asChild>
                           <span className="shrink-0">
                              <Button
                                 disabled={!hasPaymentMethod || isPending}
                                 onClick={() => onSubscribe(addon.id)}
                                 size="sm"
                                 variant="outline"
                              >
                                 Assinar
                              </Button>
                           </span>
                        </TooltipTrigger>
                        {!hasPaymentMethod && (
                           <TooltipContent>
                              <p>Ative o pay as you go para adquirir add-ons</p>
                           </TooltipContent>
                        )}
                     </Tooltip>
                  </TooltipProvider>
               )}
            </div>
         </CardContent>
      </Card>
   );
}

function AddonsSection({ hasPaymentMethod }: { hasPaymentMethod: boolean }) {
   const { activeOrganization } = useActiveOrganization();
   const { data: activeAddons } = useSuspenseQuery(
      orpc.organization.getAddons.queryOptions({}),
   );
   const activeAddonIds = new Set(
      activeAddons.map((a: ActiveAddon) => a.addonId),
   );
   const [isPending, startTransition] = useTransition();

   const handleSubscribe = (_addonId: string) => {
      startTransition(async () => {
         const result = await authClient.subscription.billingPortal({
            referenceId: activeOrganization?.id,
            returnUrl: window.location.href,
         });
         if (result.error) {
            toast.error(result.error.message ?? "Erro ao abrir portal");
            return;
         }
         if (result.data?.url) {
            window.location.href = result.data.url;
         }
      });
   };

   return (
      <div>
         <h2 className="text-lg font-semibold mb-4">Add-ons</h2>
         <div className="space-y-3">
            {PLATFORM_ADDONS.map((addon) => (
               <AddonCard
                  addon={addon}
                  hasPaymentMethod={hasPaymentMethod}
                  isActive={activeAddonIds.has(addon.id)}
                  isPending={isPending}
                  key={addon.id}
                  onSubscribe={handleSubscribe}
               />
            ))}
         </div>
      </div>
   );
}

function OverviewProductCard({ category }: { category: CategorySummary }) {
   const icon = CATEGORY_ICONS[category.category] ?? (
      <HelpCircle className="size-5" />
   );
   const freeTier = category.events.reduce(
      (sum, e) => sum + e.freeTierLimit,
      0,
   );

   return (
      <Card>
         <Collapsible>
            <CardHeader className="pb-3">
               <div className="flex items-start gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground shrink-0">
                     {icon}
                  </div>
                  <div className="min-w-0">
                     <CardTitle className="text-base capitalize">
                        {category.category}
                     </CardTitle>
                  </div>
               </div>
            </CardHeader>

            <CardContent className="space-y-4">
               <div className="flex items-center gap-4">
                  <CollapsibleTrigger className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors shrink-0">
                     <ChevronRight className="size-4 transition-transform [[data-state=open]_&]:rotate-90" />
                  </CollapsibleTrigger>

                  <div className="flex-1 flex items-center gap-6">
                     <div className="text-sm shrink-0">
                        <span className="text-muted-foreground">Atual</span>
                        <p className="font-medium tabular-nums">
                           {category.eventCount.toLocaleString("pt-BR")}
                        </p>
                     </div>

                     <div className="flex-1 space-y-1 min-w-0">
                        <Progress
                           className="h-2"
                           value={
                              freeTier > 0
                                 ? Math.min(
                                      (category.eventCount / freeTier) * 100,
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

               <CollapsibleContent>
                  <div className="border-t pt-4 space-y-3">
                     {category.events.map((event) => {
                        const hasLimit = event.freeTierLimit > 0;
                        const percentage = hasLimit
                           ? Math.min(
                                (event.used / event.freeTierLimit) * 100,
                                100,
                             )
                           : undefined;
                        const cost = computeMonthlyCost(event);

                        return (
                           <div className="space-y-1.5" key={event.eventName}>
                              <div className="flex items-center justify-between text-sm">
                                 <span>{event.displayName}</span>
                                 <div className="flex items-center gap-4">
                                    <span className="tabular-nums text-muted-foreground">
                                       {event.used.toLocaleString("pt-BR")}
                                       {hasLimit && (
                                          <span>
                                             {" "}
                                             /{" "}
                                             {event.freeTierLimit.toLocaleString(
                                                "pt-BR",
                                             )}
                                          </span>
                                       )}
                                    </span>
                                    <span className="tabular-nums font-medium w-20 text-right">
                                       {formatCurrency(cost)}
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
               </CollapsibleContent>
            </CardContent>
         </Collapsible>
      </Card>
   );
}

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
      orpc.billing.getInvoices.queryOptions({ input: { limit: 5 } }),
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

export function BillingOverview() {
   const [{ data: meterUsage }, { data: catalog }, { data: paymentStatus }] =
      useSuspenseQueries({
         queries: [
            orpc.billing.getMeterUsage.queryOptions({}),
            orpc.billing.getEventCatalog.queryOptions({}),
            orpc.billing.getPaymentStatus.queryOptions({}),
         ],
      });
   const hasPaymentMethod = paymentStatus.hasPaymentMethod;

   const categorySummaries = buildCategorySummaries(catalog, meterUsage);
   const monthToDate = categorySummaries.reduce(
      (sum, c) => sum + c.monthToDateCost,
      0,
   );

   const sortedCategories = [...categorySummaries].sort(
      (a, b) => b.monthToDateCost - a.monthToDateCost,
   );

   return (
      <div className="space-y-6">
         <CurrentBillHeader monthToDate={monthToDate} />
         <BillingPeriodSection />
         <AddCardBanner hasPaymentMethod={hasPaymentMethod} />
         <AddonsSection hasPaymentMethod={hasPaymentMethod} />

         <div>
            <h2 className="text-lg font-semibold mb-4">Produtos</h2>
            <div className="space-y-4">
               {sortedCategories.map((cat) => (
                  <OverviewProductCard category={cat} key={cat.category} />
               ))}
            </div>
         </div>

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
