import { queryCollectionOptions } from "@tanstack/query-db-collection";
import type { QueryClient } from "@tanstack/query-core";
import { orpc, type Outputs } from "@/integrations/orpc/client";

export type CreditCardSummaryCollectionRow =
   Outputs["transactions"]["getSummary"] & {
      id: string;
      creditCardId: string;
      dateFrom: string;
      dateTo: string;
   };

type CreditCardSummaryCollectionOptionsParams = {
   queryClient: QueryClient;
   creditCardId: string;
   dateFrom: string;
   dateTo: string;
};

export function creditCardSummaryCollectionOptions({
   queryClient,
   creditCardId,
   dateFrom,
   dateTo,
}: CreditCardSummaryCollectionOptionsParams) {
   const id = `${creditCardId}:${dateFrom}:${dateTo}`;
   return queryCollectionOptions({
      id: `credit-card-summary:${id}`,
      queryKey: () => ["credit-card-summary", id],
      queryFn: async () => {
         const summary = await orpc.transactions.getSummary.call({
            creditCardId,
            dateFrom,
            dateTo,
         });
         return [{ ...summary, id, creditCardId, dateFrom, dateTo }];
      },
      queryClient,
      getKey: (summary: CreditCardSummaryCollectionRow) => summary.id,
      refetchInterval: 5_000,
      syncMode: "on-demand",
   });
}
