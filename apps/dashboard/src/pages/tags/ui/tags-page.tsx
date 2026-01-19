import type { RouterOutput } from "@packages/api/client";
import { Button } from "@packages/ui/components/button";
import { Skeleton } from "@packages/ui/components/skeleton";
import { Plus } from "lucide-react";
import { Suspense } from "react";
import { DefaultHeader } from "@/default/default-header";
import { usePlanFeatures } from "@/features/billing/lib/use-plan-features";
import { UpgradeRequired } from "@/features/billing/ui/upgrade-required";
import { useSheet } from "@/hooks/use-sheet";
import { ManageTagForm } from "../features/manage-tag-form";
import { TagListProvider, useTagList } from "../features/tag-list-context";
import { TagFilterBar } from "./tag-filter-bar";
import { TagsListSection } from "./tags-list-section";
import { TagsStats } from "./tags-stats";

export type Tag = RouterOutput["tags"]["getAllPaginated"]["tags"][0];

function TagFilterBarSkeleton() {
   return (
      <div className="space-y-3">
         <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1">
               {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton
                     className="h-8 w-20"
                     key={`period-skeleton-${i + 1}`}
                  />
               ))}
            </div>
            <Skeleton className="h-8 w-32" />
         </div>
         <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1">
               <Skeleton className="h-8 w-20" />
               <Skeleton className="h-8 w-20" />
               <Skeleton className="h-8 w-24" />
            </div>
            <div className="h-8 w-px bg-border" />
            <Skeleton className="h-8 w-32" />
         </div>
      </div>
   );
}

function TagFilterBarWrapper() {
   const {
      timePeriod,
      handleTimePeriodChange,
      customDateRange,
      setCustomDateRange,
      typeFilter,
      setTypeFilter,
      orderBy,
      setOrderBy,
      orderDirection,
      setOrderDirection,
      pageSize,
      setPageSize,
      clearFilters,
      hasActiveFilters,
   } = useTagList();

   return (
      <TagFilterBar
         customDateRange={customDateRange}
         hasActiveFilters={hasActiveFilters}
         onClearFilters={clearFilters}
         onCustomDateRangeChange={setCustomDateRange}
         onOrderByChange={setOrderBy}
         onOrderDirectionChange={setOrderDirection}
         onPageSizeChange={setPageSize}
         onTimePeriodChange={handleTimePeriodChange}
         onTypeFilterChange={setTypeFilter}
         orderBy={orderBy}
         orderDirection={orderDirection}
         pageSize={pageSize}
         timePeriod={timePeriod}
         typeFilter={typeFilter}
      />
   );
}

function TagsPageContent() {
   const { openSheet } = useSheet();

   return (
      <main className="space-y-4">
         <DefaultHeader
            actions={
               <Button
                  onClick={() => openSheet({ children: <ManageTagForm /> })}
               >
                  <Plus className="size-4" />
                  Adicionar nova tag
               </Button>
            }
            description="Visualize e gerencie suas tags aqui."
            title="Suas tags"
         />

         <Suspense fallback={<TagFilterBarSkeleton />}>
            <TagFilterBarWrapper />
         </Suspense>

         <TagsStats />
         <TagsListSection />
      </main>
   );
}

export function TagsPage() {
   const { canAccessTags } = usePlanFeatures();

   return (
      <UpgradeRequired
         featureName="Tags"
         hasAccess={canAccessTags}
         requiredPlan="basic"
      >
         <TagListProvider>
            <TagsPageContent />
         </TagListProvider>
      </UpgradeRequired>
   );
}
