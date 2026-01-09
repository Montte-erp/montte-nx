import { formatDecimalCurrency } from "@packages/money";
import { Alert, AlertDescription } from "@packages/ui/components/alert";
import {
   Card,
   CardContent,
   CardHeader,
   CardTitle,
} from "@packages/ui/components/card";
import { Separator } from "@packages/ui/components/separator";
import { Skeleton } from "@packages/ui/components/skeleton";
import {
   calculateInterest,
   type InterestConfig,
} from "@packages/utils/interest";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, FileText, Percent, TrendingUp } from "lucide-react";
import { Suspense, useMemo } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useInterestRates } from "@/hooks/use-interest-rates";
import { useTRPC } from "@/integrations/clients";

function InterestCardErrorFallback() {
   return (
      <Alert variant="destructive">
         <AlertDescription>Falha ao carregar cálculo de juros</AlertDescription>
      </Alert>
   );
}

function InterestCardSkeleton() {
   return (
      <Card>
         <CardHeader>
            <Skeleton className="h-6 w-40" />
         </CardHeader>
         <CardContent className="space-y-4">
            <Skeleton className="h-12 w-full rounded-lg" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
               {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton
                     className="h-20 w-full rounded-lg"
                     key={`interest-skeleton-${i + 1}`}
                  />
               ))}
            </div>
            <Skeleton className="h-16 w-full rounded-lg" />
         </CardContent>
      </Card>
   );
}

function InterestCardContent({ billId }: { billId: string }) {
   const trpc = useTRPC();
   const { activeOrganization } = useActiveOrganization();

   const { data: bill } = useSuspenseQuery(
      trpc.bills.getById.queryOptions({ id: billId }),
   );

   const { rates, isFallback } = useInterestRates();

   const today = new Date();
   today.setHours(0, 0, 0, 0);
   const isCompleted = !!bill.completionDate;
   const isOverdue =
      bill.dueDate && !bill.completionDate && new Date(bill.dueDate) < today;

   const template = bill.interestTemplate;

   const config = useMemo<InterestConfig | null>(() => {
      if (!template) return null;
      return {
         gracePeriodDays: template.gracePeriodDays,
         interestType: template.interestType as "none" | "daily" | "monthly",
         interestValue: template.interestValue
            ? Number(template.interestValue)
            : null,
         monetaryCorrectionIndex: template.monetaryCorrectionIndex as
            | "none"
            | "ipca"
            | "selic"
            | "cdi",
         penaltyType: template.penaltyType as "none" | "percentage" | "fixed",
         penaltyValue: template.penaltyValue
            ? Number(template.penaltyValue)
            : null,
      };
   }, [template]);

   const result = useMemo(() => {
      if (!config) return null;
      return calculateInterest(
         Number(bill.amount),
         new Date(bill.dueDate),
         config,
         rates,
      );
   }, [bill.amount, bill.dueDate, config, rates]);

   if (
      bill.type !== "income" ||
      !isOverdue ||
      isCompleted ||
      !template ||
      !result
   ) {
      return null;
   }

   return (
      <Card>
         <CardHeader>
            <CardTitle className="flex items-center gap-2">
               <TrendingUp className="size-5" />
               Cálculo de Juros
            </CardTitle>
         </CardHeader>
         <CardContent className="space-y-4">
            {isFallback && (
               <Alert
                  className="border-orange-200 bg-orange-50"
                  variant="default"
               >
                  <AlertTriangle className="size-4 text-orange-600" />
                  <AlertDescription className="text-orange-800">
                     Usando taxas de referência. Valores podem não refletir
                     índices atuais (SELIC/IPCA/CDI).
                  </AlertDescription>
               </Alert>
            )}

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
               <div className="flex items-center gap-2">
                  <FileText className="size-4 text-muted-foreground" />
                  <span className="text-sm">
                     Template de Juros:
                  </span>
               </div>
               <Link
                  className="text-sm font-medium text-primary hover:underline"
                  params={{
                     interestTemplateId: template.id,
                     slug: activeOrganization.slug,
                  }}
                  to="/$slug/interest-templates/$interestTemplateId"
               >
                  {template.name}
               </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
               <div className="flex flex-col gap-1 p-3 border rounded-lg">
                  <span className="text-xs text-muted-foreground">
                     Dias em Atraso
                  </span>
                  <span className="text-lg font-semibold text-destructive">
                     {result.daysOverdue}
                  </span>
               </div>

               <div className="flex flex-col gap-1 p-3 border rounded-lg">
                  <span className="text-xs text-muted-foreground">
                     Valor Original
                  </span>
                  <span className="text-lg font-semibold">
                     {formatDecimalCurrency(Number(bill.amount))}
                  </span>
               </div>

               {result.penaltyAmount > 0 && (
                  <div className="flex flex-col gap-1 p-3 border rounded-lg">
                     <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Percent className="size-3" />
                        Multa
                     </span>
                     <span className="text-lg font-semibold text-orange-500">
                        + {formatDecimalCurrency(result.penaltyAmount)}
                     </span>
                  </div>
               )}

               {result.interestAmount > 0 && (
                  <div className="flex flex-col gap-1 p-3 border rounded-lg">
                     <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <TrendingUp className="size-3" />
                        Juros
                     </span>
                     <span className="text-lg font-semibold text-orange-500">
                        + {formatDecimalCurrency(result.interestAmount)}
                     </span>
                  </div>
               )}

               {result.correctionAmount > 0 && (
                  <div className="flex flex-col gap-1 p-3 border rounded-lg">
                     <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <TrendingUp className="size-3" />
                        Correção Monetária
                     </span>
                     <span className="text-lg font-semibold text-orange-500">
                        + {formatDecimalCurrency(result.correctionAmount)}
                     </span>
                  </div>
               )}
            </div>

            <Separator />

            <div className="flex items-center justify-between p-4 bg-primary/5 border border-primary/20 rounded-lg">
               <span className="text-sm font-medium">
                  Valor Atualizado
               </span>
               <span className="text-xl font-bold text-primary">
                  {formatDecimalCurrency(result.updatedAmount)}
               </span>
            </div>
         </CardContent>
      </Card>
   );
}

export function BillInterestCard({ billId }: { billId: string }) {
   return (
      <ErrorBoundary FallbackComponent={InterestCardErrorFallback}>
         <Suspense fallback={<InterestCardSkeleton />}>
            <InterestCardContent billId={billId} />
         </Suspense>
      </ErrorBoundary>
   );
}
