import { formatDecimalCurrency } from "@packages/money";
import {
   Card,
   CardContent,
   CardDescription,
   CardHeader,
   CardTitle,
} from "@packages/ui/components/card";
import { createErrorFallback } from "@packages/ui/components/error-fallback";
import { Skeleton } from "@packages/ui/components/skeleton";
import { formatDate } from "@packages/utils/date";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
   ArrowDownLeft,
   ArrowLeftRight,
   ArrowUpRight,
   Calendar,
   Clock,
   Landmark,
} from "lucide-react";
import { Suspense } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { useTRPC } from "@/integrations/clients";

function StatsErrorFallback(props: FallbackProps) {
   return (
      <div className="grid gap-4 h-min">
         {createErrorFallback({
            errorDescription: "Falha ao carregar estatísticas",
            errorTitle: "Error loading stats",
            retryText: "Tentar novamente",
         })(props)}
      </div>
   );
}

function StatsSkeleton() {
   return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
         {[1, 2, 3, 4].map((index) => (
            <Card
               className="col-span-1 h-full w-full"
               key={`stats-skeleton-${index}`}
            >
               <CardHeader>
                  <CardTitle>
                     <Skeleton className="h-6 w-24" />
                  </CardTitle>
                  <CardDescription>
                     <Skeleton className="h-4 w-32" />
                  </CardDescription>
               </CardHeader>
               <CardContent>
                  <Skeleton className="h-10 w-16" />
               </CardContent>
            </Card>
         ))}
      </div>
   );
}

function getTypeIcon(type: string) {
   switch (type) {
      case "income":
         return ArrowDownLeft;
      case "expense":
         return ArrowUpRight;
      case "transfer":
         return ArrowLeftRight;
      default:
         return ArrowUpRight;
   }
}

function getTypeColor(type: string) {
   switch (type) {
      case "income":
         return "text-green-600";
      case "expense":
         return "text-red-600";
      case "transfer":
         return "text-blue-600";
      default:
         return "text-muted-foreground";
   }
}

function StatsContent({ transactionId }: { transactionId: string }) {
   const trpc = useTRPC();
   const { data } = useSuspenseQuery(
      trpc.transactions.getById.queryOptions({ id: transactionId }),
   );

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

   const createdAt = formatDate(new Date(data.createdAt), "DD/MM/YYYY");
   const TypeIcon = getTypeIcon(data.type);
   const typeColor = getTypeColor(data.type);

   return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
         <Card>
            <CardHeader className="pb-2">
               <CardTitle className="text-sm font-medium text-muted-foreground">
                  Valor
               </CardTitle>
            </CardHeader>
            <CardContent>
               <div
                  className={`text-2xl font-bold tabular-nums ${isPositive ? "text-green-600" : "text-red-600"}`}
               >
                  {isPositive ? "+" : "-"}
                  {formattedAmount}
               </div>
               <p className="text-xs text-muted-foreground mt-1">
                  Valor total da transação
               </p>
            </CardContent>
         </Card>

         <Card>
            <CardHeader className="pb-2">
               <CardTitle className="text-sm font-medium text-muted-foreground">
                  Tipo
               </CardTitle>
            </CardHeader>
            <CardContent>
               <div className="flex items-center gap-2">
                  <TypeIcon className={`size-5 ${typeColor}`} />
                  <span className="text-lg font-semibold">
                     {typeLabels[data.type] || data.type}
                  </span>
               </div>
               <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                  <Calendar className="size-3.5" />
                  {formattedDate}
               </div>
            </CardContent>
         </Card>

         <Card>
            <CardHeader className="pb-2">
               <CardTitle className="text-sm font-medium text-muted-foreground">
                  Conta Bancária
               </CardTitle>
            </CardHeader>
            <CardContent>
               <div className="flex items-center gap-2">
                  <Landmark className="size-5 text-muted-foreground" />
                  <span className="text-lg font-semibold">
                     {data.bankAccount?.name || "-"}
                  </span>
               </div>
               {data.bankAccount?.bank && (
                  <p className="text-xs text-muted-foreground mt-1 ml-7">
                     {data.bankAccount.bank}
                  </p>
               )}
            </CardContent>
         </Card>

         <Card>
            <CardHeader className="pb-2">
               <CardTitle className="text-sm font-medium text-muted-foreground">
                  Criado em
               </CardTitle>
            </CardHeader>
            <CardContent>
               <div className="flex items-center gap-2">
                  <Clock className="size-5 text-muted-foreground" />
                  <span className="text-lg font-semibold">{createdAt}</span>
               </div>
               <p className="text-xs text-muted-foreground mt-1 ml-7">
                  Data de registro no sistema
               </p>
            </CardContent>
         </Card>
      </div>
   );
}

export function TransactionStats({ transactionId }: { transactionId: string }) {
   return (
      <ErrorBoundary FallbackComponent={StatsErrorFallback}>
         <Suspense fallback={<StatsSkeleton />}>
            <StatsContent transactionId={transactionId} />
         </Suspense>
      </ErrorBoundary>
   );
}
