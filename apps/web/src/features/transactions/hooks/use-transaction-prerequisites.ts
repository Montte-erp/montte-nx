import { useSuspenseQuery } from "@tanstack/react-query";
import { orpc } from "@/integrations/orpc/client";

export function useTransactionPrerequisites() {
   const { data: bankAccounts } = useSuspenseQuery(
      orpc.bankAccounts.getAll.queryOptions({}),
   );

   return {
      hasBankAccounts: bankAccounts.length > 0,
   };
}
