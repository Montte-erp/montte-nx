import { format, of } from "@f-o-t/money";
import {
   Card,
   CardContent,
   CardHeader,
   CardTitle,
} from "@packages/ui/components/card";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AlertTriangle, TrendingDown, TrendingUp } from "lucide-react";
import { orpc } from "@/integrations/orpc/client";

function formatBRL(value: string | number): string {
   return format(of(String(value), "BRL"), "pt-BR");
}

export function TransactionsSummaryCards() {
   const { data } = useSuspenseQuery(
      orpc.transactions.getPayableSummary.queryOptions({}),
   );

   return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
         <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
               <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total a Pagar
               </CardTitle>
               <TrendingDown className="size-4 text-destructive" />
            </CardHeader>
            <CardContent>
               <p className="text-2xl font-semibold tabular-nums text-destructive">
                  {formatBRL(data.totalPayable)}
               </p>
            </CardContent>
         </Card>
         <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
               <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total a Receber
               </CardTitle>
               <TrendingUp className="size-4 text-green-600 dark:text-green-500" />
            </CardHeader>
            <CardContent>
               <p className="text-2xl font-semibold tabular-nums text-green-600 dark:text-green-500">
                  {formatBRL(data.totalReceivable)}
               </p>
            </CardContent>
         </Card>
         <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
               <CardTitle className="text-sm font-medium text-muted-foreground">
                  Vencidos
               </CardTitle>
               <AlertTriangle className="size-4 text-amber-500" />
            </CardHeader>
            <CardContent>
               <p className="text-2xl font-semibold tabular-nums">
                  {data.overdueCount}
               </p>
            </CardContent>
         </Card>
      </div>
   );
}
