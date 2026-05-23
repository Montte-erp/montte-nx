import { format, of } from "@f-o-t/money";
import { Skeleton } from "@packages/ui/components/skeleton";
import { createCollection, useLiveQuery } from "@tanstack/react-db";
import type { QueryClient } from "@tanstack/query-core";
import dayjs from "dayjs";
import { Receipt } from "lucide-react";
import { useMemo } from "react";
import { creditCardSummaryCollectionOptions } from "@/integrations/tanstack-db/credit-cards";

interface Props {
   creditCardId: string;
   queryClient: QueryClient;
}

export function CreditCardFaturaRow({ creditCardId, queryClient }: Props) {
   const dateFrom = dayjs().startOf("month").format("YYYY-MM-DD");
   const dateTo = dayjs().endOf("month").format("YYYY-MM-DD");

   const summaryCollection = useMemo(
      () =>
         createCollection(
            creditCardSummaryCollectionOptions({
               queryClient,
               creditCardId,
               dateFrom,
               dateTo,
            }),
         ),
      [creditCardId, dateFrom, dateTo, queryClient],
   );

   const { data: summaries, isLoading } = useLiveQuery(
      (q) =>
         q
            .from({ summary: summaryCollection })
            .select(({ summary }) => summary),
      [summaryCollection],
   );

   const summary = summaries[0];

   if (isLoading || !summary) {
      return <Skeleton className="h-10 w-full" />;
   }

   const expenseFormatted = format(
      of(summary.expenseTotal ?? "0", "BRL"),
      "pt-BR",
   );

   return (
      <div className="flex items-center gap-4 px-4 py-3 bg-muted/30 text-sm">
         <Receipt className="size-4 text-muted-foreground shrink-0" />
         <span className="text-muted-foreground font-medium">
            Fatura {dayjs().format("MM/YYYY")}
         </span>
         <div className="flex gap-4">
            <span>
               <span className="text-muted-foreground">Lançamentos: </span>
               <span className="font-medium tabular-nums">
                  {summary.totalCount}
               </span>
            </span>
            <span>
               <span className="text-muted-foreground">Total: </span>
               <span className="font-medium tabular-nums text-destructive">
                  {expenseFormatted}
               </span>
            </span>
         </div>
      </div>
   );
}
