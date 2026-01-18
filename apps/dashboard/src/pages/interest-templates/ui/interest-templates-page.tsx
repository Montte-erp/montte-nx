import type { RouterOutput } from "@packages/api/client";
import { Button } from "@packages/ui/components/button";
import { Skeleton } from "@packages/ui/components/skeleton";
import { Plus } from "lucide-react";
import { Suspense } from "react";
import { UpgradeRequired } from "@/features/billing/ui/upgrade-required";
import { DefaultHeader } from "@/default/default-header";
import { usePlanFeatures } from "@/features/billing/lib/use-plan-features";
import { useSheet } from "@/hooks/use-sheet";
import {
   InterestTemplateListProvider,
   useInterestTemplateList,
} from "../features/interest-template-list-context";
import { ManageInterestTemplateForm } from "../features/manage-interest-template-form";
import { InterestTemplateFilterBar } from "./interest-template-filter-bar";
import { InterestTemplatesListSection } from "./interest-templates-list-section";
import { InterestTemplatesStats } from "./interest-templates-stats";

export type InterestTemplate =
   RouterOutput["interestTemplates"]["getAllPaginated"]["templates"][0];

function InterestTemplateFilterBarSkeleton() {
   return (
      <div className="flex flex-wrap items-center gap-3">
         <div className="flex gap-1">
            {Array.from({ length: 3 }).map((_, i) => (
               <Skeleton
                  className="h-8 w-20"
                  key={`status-skeleton-${i + 1}`}
               />
            ))}
         </div>
         <div className="h-4 w-px bg-border" />
         <div className="flex gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
               <Skeleton
                  className="h-8 w-14"
                  key={`correction-skeleton-${i + 1}`}
               />
            ))}
         </div>
         <div className="h-4 w-px bg-border" />
         <Skeleton className="h-8 w-28" />
      </div>
   );
}

function InterestTemplateFilterBarWrapper() {
   const {
      statusFilter,
      setStatusFilter,
      monetaryCorrectionFilter,
      setMonetaryCorrectionFilter,
      interestTypeFilter,
      setInterestTypeFilter,
      penaltyTypeFilter,
      setPenaltyTypeFilter,
      isDefaultFilter,
      setIsDefaultFilter,
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
   } = useInterestTemplateList();

   const handleDateRangeChange = (range: {
      startDate: Date | null;
      endDate: Date | null;
   }) => {
      setStartDate(range.startDate);
      setEndDate(range.endDate);
   };

   return (
      <InterestTemplateFilterBar
         endDate={endDate}
         hasActiveFilters={hasActiveFilters}
         interestTypeFilter={interestTypeFilter}
         isDefaultFilter={isDefaultFilter}
         monetaryCorrectionFilter={monetaryCorrectionFilter}
         onClearFilters={clearFilters}
         onDateRangeChange={handleDateRangeChange}
         onInterestTypeFilterChange={setInterestTypeFilter}
         onIsDefaultFilterChange={setIsDefaultFilter}
         onMonetaryCorrectionFilterChange={setMonetaryCorrectionFilter}
         onOrderDirectionChange={setOrderDirection}
         onPageSizeChange={setPageSize}
         onPenaltyTypeFilterChange={setPenaltyTypeFilter}
         onStatusFilterChange={setStatusFilter}
         orderDirection={orderDirection}
         pageSize={pageSize}
         penaltyTypeFilter={penaltyTypeFilter}
         startDate={startDate}
         statusFilter={statusFilter}
      />
   );
}

function InterestTemplatesPageContent() {
   const { openSheet } = useSheet();

   return (
      <main className="space-y-4">
         <DefaultHeader
            actions={
               <Button
                  onClick={() =>
                     openSheet({
                        children: <ManageInterestTemplateForm />,
                     })
                  }
               >
                  <Plus className="size-4" />
                  Novo Modelo
               </Button>
            }
            description="Gerencie modelos de juros e multas para suas contas"
            title="Modelos de Juros"
         />

         <Suspense fallback={<InterestTemplateFilterBarSkeleton />}>
            <InterestTemplateFilterBarWrapper />
         </Suspense>

         <InterestTemplatesStats />
         <InterestTemplatesListSection />
      </main>
   );
}

export function InterestTemplatesPage() {
   const { canAccessInterestTemplates } = usePlanFeatures();

   return (
      <UpgradeRequired
         featureName="Modelos de Juros"
         hasAccess={canAccessInterestTemplates}
         requiredPlan="erp"
      >
         <InterestTemplateListProvider>
            <InterestTemplatesPageContent />
         </InterestTemplateListProvider>
      </UpgradeRequired>
   );
}
