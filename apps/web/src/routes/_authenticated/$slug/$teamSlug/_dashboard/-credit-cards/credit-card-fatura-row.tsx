import { useSuspenseQuery } from "@tanstack/react-query";
import { Skeleton } from "@packages/ui/components/skeleton";
import { QueryBoundary } from "@/components/query-boundary";
import { orpc } from "@/integrations/orpc/client";
import { format, of } from "@f-o-t/money";
import { Receipt } from "lucide-react";
import dayjs from "dayjs";

interface Props {
   creditCardId: string;
}

function FaturaContent({ creditCardId }: Props) {
   const dateFrom = dayjs().startOf("month").format("YYYY-MM-DD");
   const dateTo = dayjs().endOf("month").format("YYYY-MM-DD");

   const { data: summary } = useSuspenseQuery(
      orpc.transactions.getSummary.queryOptions({
         input: {
            creditCardId,
            dateFrom,
            dateTo,
         },
      }),
   );

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

export function CreditCardFaturaRow({ creditCardId }: Props) {
   return (
      <QueryBoundary
         fallback={<Skeleton className="h-10 w-full" />}
         errorTitle=""
      >
         <FaturaContent creditCardId={creditCardId} />
      </QueryBoundary>
   );
}
