import type {
   BreakdownConfig,
   InsightConfig,
   KpiConfig,
   TimeSeriesConfig,
   TransactionFilters,
} from "@modules/insights/types";
import { Button } from "@packages/ui/components/button";
import { Card, CardContent } from "@packages/ui/components/card";
import { cn } from "@packages/ui/lib/utils";
import { BarChart3, Hash, TrendingUp } from "lucide-react";
import type React from "react";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import type { InsightType } from "@/features/analytics/hooks/use-insight-config";
import { BreakdownQueryBuilder } from "./breakdown-query-builder";
import { InsightFilterBar } from "./insight-filter-bar";
import { InsightHeader } from "./insight-header";
import {
   InsightErrorState,
   InsightLoadingState,
   InsightPreview,
} from "./insight-preview";
import { InsightStatusLine } from "./insight-status-line";
import { KpiQueryBuilder } from "./kpi-query-builder";
import { TimeSeriesQueryBuilder } from "./time-series-query-builder";

const INSIGHT_TABS: {
   value: InsightType;
   label: string;
   icon: React.ElementType;
}[] = [
   { value: "kpi", label: "KPI", icon: Hash },
   { value: "time_series", label: "Série Temporal", icon: TrendingUp },
   { value: "breakdown", label: "Distribuição", icon: BarChart3 },
];

interface InsightBuilderProps {
   name: string;
   onNameChange: (name: string) => void;
   description: string;
   onDescriptionChange: (description: string) => void;
   type: InsightType;
   config: InsightConfig;
   onTypeChange: (type: InsightType) => void;
   onConfigUpdate: (updates: Partial<InsightConfig>) => void;
   onSave: () => void;
   isSaving: boolean;
   onDuplicate?: () => void;
   onDelete?: () => void;
   lastComputedAt?: Date | null;
   onRefresh: () => void;
   isRefreshing?: boolean;
}

function getFilters(config: InsightConfig): TransactionFilters {
   return config.filters;
}

export function InsightBuilder({
   name,
   onNameChange,
   description,
   onDescriptionChange,
   type,
   config,
   onTypeChange,
   onConfigUpdate,
   onSave,
   isSaving,
   onDuplicate,
   onDelete,
   lastComputedAt,
   onRefresh,
   isRefreshing = false,
}: InsightBuilderProps) {
   const handleFiltersChange = (updates: Partial<TransactionFilters>) => {
      onConfigUpdate({
         filters: { ...getFilters(config), ...updates },
      } as Partial<InsightConfig>);
   };

   const previewPanel = (
      <Card className="flex-1 min-w-0">
         <CardContent className="p-0">
            <div className="px-4">
               <InsightFilterBar
                  filters={getFilters(config)}
                  onFiltersChange={handleFiltersChange}
               />
            </div>
            <div className="px-4">
               <InsightStatusLine
                  isRefreshing={isRefreshing}
                  lastComputedAt={lastComputedAt}
                  onRefresh={onRefresh}
               />
            </div>
            <div className="min-h-[400px] p-4">
               <ErrorBoundary
                  fallbackRender={({ error }) => (
                     <InsightErrorState error={error as Error} />
                  )}
               >
                  <Suspense fallback={<InsightLoadingState />}>
                     <InsightPreview config={config} />
                  </Suspense>
               </ErrorBoundary>
            </div>
         </CardContent>
      </Card>
   );

   return (
      <main className="flex flex-col gap-0">
         <InsightHeader
            description={description}
            isSaving={isSaving}
            name={name}
            onDelete={onDelete}
            onDescriptionChange={onDescriptionChange}
            onDuplicate={onDuplicate}
            onNameChange={onNameChange}
            onSave={onSave}
         />

         <div className="flex items-center border-t border-b py-1">
            {INSIGHT_TABS.map((tab) => {
               const Icon = tab.icon;
               return (
                  <Button
                     className={cn(
                        "px-4 py-2 h-auto rounded-none border-b-2 text-sm font-medium gap-1.5",
                        type === tab.value
                           ? "border-primary text-primary"
                           : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/50",
                     )}
                     key={tab.value}
                     onClick={() => onTypeChange(tab.value)}
                     variant="ghost"
                  >
                     <Icon className="size-3.5" />
                     {tab.label}
                  </Button>
               );
            })}
         </div>

         <div className="flex flex-col gap-4 pt-4">
            {type === "kpi" && (
               <div className="flex gap-4">
                  <div className="w-[320px] shrink-0">
                     <Card className="sticky top-4">
                        <CardContent className="p-6">
                           <KpiQueryBuilder
                              config={config as KpiConfig}
                              onUpdate={onConfigUpdate}
                           />
                        </CardContent>
                     </Card>
                  </div>
                  {previewPanel}
               </div>
            )}

            {type === "time_series" && (
               <>
                  <Card>
                     <CardContent className="p-6">
                        <TimeSeriesQueryBuilder
                           config={config as TimeSeriesConfig}
                           onUpdate={onConfigUpdate}
                        />
                     </CardContent>
                  </Card>
                  {previewPanel}
               </>
            )}

            {type === "breakdown" && (
               <div className="flex gap-4">
                  <div className="w-[320px] shrink-0">
                     <Card className="sticky top-4">
                        <CardContent className="p-6">
                           <BreakdownQueryBuilder
                              config={config as BreakdownConfig}
                              onUpdate={onConfigUpdate}
                           />
                        </CardContent>
                     </Card>
                  </div>
                  {previewPanel}
               </div>
            )}
         </div>
      </main>
   );
}
