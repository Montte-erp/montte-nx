import { formatDecimalCurrency } from "@packages/money";
import { Alert, AlertDescription } from "@packages/ui/components/alert";
import { Badge } from "@packages/ui/components/badge";
import {
   Item,
   ItemContent,
   ItemDescription,
   ItemMedia,
   ItemTitle,
} from "@packages/ui/components/item";
import { Skeleton } from "@packages/ui/components/skeleton";
import { formatDate } from "@packages/utils/date";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import type { IconName } from "@/features/icon-selector/lib/available-icons";
import { IconDisplay } from "@/features/icon-selector/ui/icon-display";
import { useTRPC } from "@/integrations/clients";

function InfoErrorFallback() {
   return (
      <Alert variant="destructive">
         <AlertDescription>
            Falha ao carregar informações da transação
         </AlertDescription>
      </Alert>
   );
}

function InfoSkeleton() {
   return (
      <Item className="w-full rounded-lg" variant="outline">
         <ItemMedia className="hidden md:flex">
            <Skeleton className="size-12 rounded-full" />
         </ItemMedia>
         <ItemContent>
            <ItemTitle>
               <Skeleton className="h-4 md:h-5 w-24 md:w-32" />
            </ItemTitle>
            <ItemDescription>
               <Skeleton className="h-3 md:h-4 w-40 md:w-48" />
            </ItemDescription>
         </ItemContent>
      </Item>
   );
}

function TransactionContent({ transactionId }: { transactionId: string }) {
   const trpc = useTRPC();
   const { data } = useSuspenseQuery(
      trpc.transactions.getById.queryOptions({ id: transactionId }),
   );

   const primaryCategory = data.transactionCategories?.[0]?.category;
   const categoryColor = primaryCategory?.color || "#6b7280";
   const categoryIcon = primaryCategory?.icon || "Receipt";

   const amount = parseFloat(data.amount);
   const isPositive =
      data.type === "income" || (data.type === "transfer" && amount > 0);
   const formattedAmount = formatDecimalCurrency(Math.abs(amount));
   const formattedDate = formatDate(new Date(data.date), "DD MMMM YYYY");

   const typeLabels: Record<string, string> = {
      expense: "Despesa",
      income: "Receita",
      transfer: "Transferência",
   };

   return (
      <Item className="w-full rounded-lg" variant="outline">
         <ItemMedia
            className="hidden md:flex"
            style={{
               backgroundColor: categoryColor,
            }}
            variant="icon"
         >
            <IconDisplay iconName={categoryIcon as IconName} size={20} />
         </ItemMedia>
         <ItemContent>
            <div className="flex flex-col md:flex-row md:items-center gap-2">
               <ItemTitle className="text-base md:text-lg">
                  {data.description}
               </ItemTitle>
               <Badge variant={isPositive ? "default" : "destructive"}>
                  {isPositive ? "+" : "-"}
                  {formattedAmount}
               </Badge>
            </div>
            <ItemDescription className="flex flex-wrap items-center gap-1 md:gap-2 text-xs md:text-sm">
               <span>{formattedDate}</span>
               <span>•</span>
               <span>{typeLabels[data.type] || data.type}</span>
               {data.bankAccount && (
                  <>
                     <span>•</span>
                     <span>{data.bankAccount.name}</span>
                  </>
               )}
            </ItemDescription>
         </ItemContent>
      </Item>
   );
}

export function TransactionInfo({ transactionId }: { transactionId: string }) {
   return (
      <ErrorBoundary FallbackComponent={InfoErrorFallback}>
         <Suspense fallback={<InfoSkeleton />}>
            <TransactionContent transactionId={transactionId} />
         </Suspense>
      </ErrorBoundary>
   );
}
