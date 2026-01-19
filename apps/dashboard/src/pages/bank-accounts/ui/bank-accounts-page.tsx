import { Button } from "@packages/ui/components/button";
import { Plus } from "lucide-react";
import { useState } from "react";
import { DefaultHeader } from "@/default/default-header";
import { ManageBankAccountForm } from "@/features/bank-account/ui/manage-bank-account-form";
import { useSheet } from "@/hooks/use-sheet";
import { BankAccountsFilterBar } from "./bank-accounts-filter-bar";
import { BankAccountsListSection } from "./bank-accounts-list-section";
import { BankAccountsStats } from "./bank-accounts-stats";

export function BankAccountsPage() {
   const { openSheet } = useSheet();

   const [statusFilter, setStatusFilter] = useState<string>("");
   const [typeFilter, setTypeFilter] = useState<string>("");

   const hasActiveFilters = statusFilter !== "" || typeFilter !== "";

   const handleClearFilters = () => {
      setStatusFilter("");
      setTypeFilter("");
   };

   return (
      <main className=" space-y-4">
         <DefaultHeader
            actions={
               <Button
                  onClick={() =>
                     openSheet({ children: <ManageBankAccountForm /> })
                  }
               >
                  <Plus className="size-4" />
                  Nova Conta Bancária
               </Button>
            }
            description="Veja todas as suas contas bancárias aqui."
            title="Contas Bancárias"
         />
         <BankAccountsFilterBar
            hasActiveFilters={hasActiveFilters}
            onClearFilters={handleClearFilters}
            onStatusFilterChange={setStatusFilter}
            onTypeFilterChange={setTypeFilter}
            statusFilter={statusFilter}
            typeFilter={typeFilter}
         />
         <BankAccountsStats
            statusFilter={statusFilter}
            typeFilter={typeFilter}
         />
         <BankAccountsListSection
            statusFilter={statusFilter}
            typeFilter={typeFilter}
         />
      </main>
   );
}
