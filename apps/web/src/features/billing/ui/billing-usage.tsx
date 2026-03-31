import {
   Card,
   CardContent,
   CardDescription,
   CardHeader,
   CardTitle,
} from "@packages/ui/components/card";
import { Progress } from "@packages/ui/components/progress";
import { Skeleton } from "@packages/ui/components/skeleton";
import { useSuspenseQuery } from "@tanstack/react-query";
import { orpc } from "@/integrations/orpc/client";
import type { Outputs } from "@/integrations/orpc/client";

type MeterUsageItem = Outputs["billing"]["getMeterUsage"][number];

const CATEGORY_LABELS: Record<string, string> = {
   finance: "Financeiro",
   ai: "Inteligencia Artificial",
   workflow: "Automacoes",
   contact: "Contatos",
   crm: "CRM",
   document: "Documentos",
   inventory: "Estoque",
   service: "Servicos",
   coworking: "Coworking",
   webhook: "Webhooks",
   payment: "Pagamentos",
   nfe: "NF-e",
};

function getCategoryFromEventName(eventName: string): string {
   return eventName.split(".")[0] ?? "system";
}

function humanizeEventName(eventName: string): string {
   const parts = eventName.split(".");
   const name = parts[parts.length - 1] ?? eventName;
   return name
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatBRL(value: number): string {
   return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 4,
   });
}

function EventRow({ item }: { item: MeterUsageItem }) {
   const hasLimit = item.freeTierLimit > 0;
   const overage = Math.max(0, item.used - item.freeTierLimit);
   const cost = overage * parseFloat(item.pricePerEvent);
   const percentage = hasLimit
      ? Math.min((item.used / item.freeTierLimit) * 100, 100)
      : 0;

   return (
      <div className="flex flex-col gap-2 py-3 border-b last:border-b-0">
         <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
               <p className="text-sm font-medium truncate">
                  {humanizeEventName(item.eventName)}
               </p>
               <p className="text-xs text-muted-foreground font-mono">
                  {item.eventName}
               </p>
            </div>
            <div className="flex items-center gap-6 shrink-0 text-sm">
               <div className="text-right">
                  <p className="tabular-nums font-medium">
                     {item.used.toLocaleString("pt-BR")}
                     {hasLimit && (
                        <span className="text-muted-foreground">
                           {" "}/ {item.freeTierLimit.toLocaleString("pt-BR")}
                        </span>
                     )}
                  </p>
                  <p className="text-xs text-muted-foreground">Uso / Gratuito</p>
               </div>
               <div className="text-right">
                  <p className="tabular-nums font-medium">
                     {formatBRL(parseFloat(item.pricePerEvent))}
                  </p>
                  <p className="text-xs text-muted-foreground">Por evento</p>
               </div>
               <div className="text-right w-24">
                  <p
                     className={`tabular-nums font-semibold ${cost > 0 ? "text-foreground" : "text-muted-foreground"}`}
                  >
                     {formatBRL(cost)}
                  </p>
                  <p className="text-xs text-muted-foreground">Cobrado</p>
               </div>
            </div>
         </div>
         {hasLimit && <Progress className="h-1.5" value={percentage} />}
      </div>
   );
}

function UsageSkeleton() {
   return (
      <div className="space-y-4">
         {Array.from({ length: 4 }).map((_, i) => (
            <Card key={`skeleton-${i + 1}`}>
               <CardHeader>
                  <Skeleton className="h-5 w-32" />
               </CardHeader>
               <CardContent className="space-y-3">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
               </CardContent>
            </Card>
         ))}
      </div>
   );
}

export function BillingUsage() {
   const { data: meterUsage } = useSuspenseQuery(
      orpc.billing.getMeterUsage.queryOptions({}),
   );

   const byCategory = new Map<string, MeterUsageItem[]>();
   for (const item of meterUsage) {
      const cat = getCategoryFromEventName(item.eventName);
      const existing = byCategory.get(cat) ?? [];
      existing.push(item);
      byCategory.set(cat, existing);
   }

   const sortedCategories = [...byCategory.entries()].sort(([a], [b]) =>
      (CATEGORY_LABELS[a] ?? a).localeCompare(CATEGORY_LABELS[b] ?? b),
   );

   if (sortedCategories.length === 0) {
      return (
         <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
               Nenhum evento registrado este mês
            </CardContent>
         </Card>
      );
   }

   return (
      <div className="space-y-4">
         {sortedCategories.map(([category, items]) => (
            <Card key={category}>
               <CardHeader>
                  <CardTitle className="text-base">
                     {CATEGORY_LABELS[category] ?? category}
                  </CardTitle>
                  <CardDescription>
                     Uso atual do mes vs. limite gratuito
                  </CardDescription>
               </CardHeader>
               <CardContent>
                  {items.map((item) => (
                     <EventRow item={item} key={item.eventName} />
                  ))}
               </CardContent>
            </Card>
         ))}
      </div>
   );
}
