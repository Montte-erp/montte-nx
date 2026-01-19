import type { RouterOutput } from "@packages/api/client";
import { Button } from "@packages/ui/components/button";
import { Skeleton } from "@packages/ui/components/skeleton";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Suspense } from "react";
import { DefaultHeader } from "@/default/default-header";
import { useSheet } from "@/hooks/use-sheet";
import { useTRPC } from "@/integrations/clients";
import {
   CounterpartyListProvider,
   useCounterpartyList,
} from "../features/counterparty-list-context";
import { ManageCounterpartyForm } from "../features/manage-counterparty-form";
import { CounterpartiesListSection } from "./counterparties-list-section";
import { CounterpartiesStats } from "./counterparties-stats";
import { CounterpartyFilterBar } from "./counterparty-filter-bar";

export type Counterparty =
   RouterOutput["counterparties"]["getAllPaginated"]["counterparties"][0];

function CounterpartyFilterBarSkeleton() {
   return (
      <div className="flex flex-wrap items-center gap-3">
         <div className="flex gap-1">
            {Array.from({ length: 4 }).map((_, i) => (
               <Skeleton className="h-8 w-20" key={`type-skeleton-${i + 1}`} />
            ))}
         </div>
         <div className="h-4 w-px bg-border" />
         <div className="flex gap-1">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-20" />
         </div>
         <div className="h-4 w-px bg-border" />
         <Skeleton className="h-8 w-28" />
      </div>
   );
}

function CounterpartyFilterBarWrapper() {
   const trpc = useTRPC();
   const {
      typeFilter,
      setTypeFilter,
      statusFilter,
      setStatusFilter,
      industryFilter,
      setIndustryFilter,
      startDate,
      setStartDate,
      endDate,
      setEndDate,
      orderDirection,
      setOrderDirection,
      pageSize,
      setPageSize,
      clearFilters,
      hasActiveFilters,
   } = useCounterpartyList();

   const { data: industries = [] } = useSuspenseQuery(
      trpc.counterparties.getIndustries.queryOptions(),
   );

   const handleDateRangeChange = (range: {
      startDate: Date | null;
      endDate: Date | null;
   }) => {
      setStartDate(range.startDate);
      setEndDate(range.endDate);
   };

   return (
      <CounterpartyFilterBar
         endDate={endDate}
         hasActiveFilters={hasActiveFilters}
         industries={industries}
         industryFilter={industryFilter}
         onClearFilters={clearFilters}
         onDateRangeChange={handleDateRangeChange}
         onIndustryFilterChange={setIndustryFilter}
         onOrderDirectionChange={setOrderDirection}
         onPageSizeChange={setPageSize}
         onStatusFilterChange={setStatusFilter}
         onTypeFilterChange={setTypeFilter}
         orderDirection={orderDirection}
         pageSize={pageSize}
         startDate={startDate}
         statusFilter={statusFilter}
         typeFilter={typeFilter}
      />
   );
}

function CounterpartiesPageContent() {
   const { openSheet } = useSheet();

   return (
      <main className="space-y-4">
         <DefaultHeader
            actions={
               <Button
                  onClick={() =>
                     openSheet({
                        children: <ManageCounterpartyForm />,
                     })
                  }
               >
                  <Plus className="size-4" />
                  Adicionar Cadastro
               </Button>
            }
            description="Gerencie seus clientes, fornecedores e parceiros comerciais"
            title="Fornecedores e Clientes"
         />

         <Suspense fallback={<CounterpartyFilterBarSkeleton />}>
            <CounterpartyFilterBarWrapper />
         </Suspense>

         <CounterpartiesStats />
         <CounterpartiesListSection />
      </main>
   );
}

export function CounterpartiesPage() {
   return (
      <CounterpartyListProvider>
         <CounterpartiesPageContent />
      </CounterpartyListProvider>
   );
}
