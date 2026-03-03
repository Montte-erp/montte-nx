import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/integrations/orpc/client";

export function useTransactionPrerequisites() {
   const { data: bankAccounts = [] } = useQuery(
      orpc.bankAccounts.getAll.queryOptions({}),
   );

   return {
      hasBankAccounts: bankAccounts.length > 0,
   };
}
