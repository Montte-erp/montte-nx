import type { Condition } from "@f-o-t/condition-evaluator";
import type {
   Dashboard,
   DashboardDateRange,
} from "@core/database/schemas/dashboards";
import { Button } from "@packages/ui/components/button";
import { DateRangePicker } from "@packages/ui/components/date-range-picker";
import { cn } from "@packages/ui/lib/utils";
import { formatRelativeTime } from "@core/utils/date";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
   Check,
   Clock,
   Layout,
   Loader2,
   Plus,
   RefreshCw,
   RotateCcw,
   X,
} from "lucide-react";
import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { DashboardFilterPopover } from "@/features/analytics/ui/dashboard-filter-popover";
import { EditableDashboardGrid } from "@/features/analytics/ui/editable-dashboard-grid";
import { orpc } from "@/integrations/orpc/client";

// =============================================================================
// Types
// =============================================================================

interface DashboardViewProps {
   dashboard: Dashboard;
   children?: ReactNode;
}

// =============================================================================
// Header (PostHog-style inline editing)
// =============================================================================

function DashboardHeader({
   dashboard,
   onAddInsight,
   isEditingLayout,
   isSaving,
   onSave,
   onCancel,
   onEnterEdit,
}: {
   dashboard: Dashboard;
   onAddInsight: () => void;
   isEditingLayout: boolean;
   isSaving: boolean;
   onSave: () => void;
   onCancel: () => void;
   onEnterEdit: () => void;
}) {
   const queryClient = useQueryClient();

   const updateMutation = useMutation(
      orpc.dashboards.update.mutationOptions({
         onSuccess: () => {
            queryClient.invalidateQueries({
               queryKey: orpc.analytics.getDefaultDashboard.queryKey(),
            });
            queryClient.invalidateQueries({
               queryKey: orpc.dashboards.getById.queryKey({
                  input: { id: dashboard.id },
               }),
            });
            queryClient.invalidateQueries({
               queryKey: orpc.dashboards.list.queryKey({}),
            });
         },
      }),
   );

   const handleNameSave = useCallback(
      (name: string) => {
         if (name) {
            updateMutation.mutate({ id: dashboard.id, name });
         }
      },
      [updateMutation, dashboard.id],
   );

   const handleDescriptionSave = useCallback(
      (description: string) => {
         updateMutation.mutate({
            id: dashboard.id,
            description: description || undefined,
         });
      },
      [updateMutation, dashboard.id],
   );

   return (
      <PageHeader
         actions={
            isEditingLayout ? (
               <div className="flex items-center gap-2">
                  <Button onClick={onCancel} variant="ghost">
                     <RotateCcw className="size-4" />
                     Cancelar
                  </Button>
                  <Button disabled={isSaving} onClick={onSave}>
                     {isSaving ? (
                        <Loader2 className="size-4 animate-spin" />
                     ) : (
                        <Check className="size-4" />
                     )}
                     Salvar
                  </Button>
               </div>
            ) : (
               <Button onClick={onAddInsight}>
                  <Plus className="size-3.5" />
                  Adicionar insight
               </Button>
            )
         }
         className="pb-3"
         description={dashboard.description ?? ""}
         descriptionPlaceholder="Adicionar descrição (opcional)"
         editable
         onDescriptionChange={handleDescriptionSave}
         onTitleChange={handleNameSave}
         panelActions={
            !isEditingLayout
               ? [
                    {
                       icon: Layout,
                       label: "Editar layout",
                       onClick: onEnterEdit,
                    },
                 ]
               : undefined
         }
         title={dashboard.name}
         titlePlaceholder="Nome do dashboard"
      />
   );
}

// =============================================================================
// Filter Bar
// =============================================================================

const DATE_RANGE_PRESETS = [
   { label: "Últimos 7 dias", value: "7d" },
   { label: "Últimos 30 dias", value: "30d" },
   { label: "Últimos 90 dias", value: "90d" },
   { label: "Este mês", value: "this_month" },
   { label: "Mês passado", value: "last_month" },
   { label: "Este ano", value: "this_year" },
] as const;

function DashboardFilterBar({ dashboard }: { dashboard: Dashboard }) {
   const queryClient = useQueryClient();
   const { data: insights } = useSuspenseQuery(
      orpc.analytics.getDashboardInsights.queryOptions({
         input: { dashboardId: dashboard.id },
      }),
   );

   const lastRefreshedTime = useMemo(() => {
      if (!insights || insights.length === 0) return null;

      const oldestComputedAt = insights.reduce(
         (oldest, insight) => {
            if (!insight.lastComputedAt) return oldest;
            if (!oldest) return insight.lastComputedAt;
            return insight.lastComputedAt < oldest
               ? insight.lastComputedAt
               : oldest;
         },
         null as Date | null,
      );

      return oldestComputedAt ? formatRelativeTime(oldestComputedAt) : null;
   }, [insights]);

   const refreshMutation = useMutation(
      orpc.insights.refreshDashboard.mutationOptions({
         onSuccess: () => {
            // Reset insight queries so tiles re-suspend with loading skeletons
            const insightIds = [
               ...new Set(dashboard.tiles.map((t) => t.insightId)),
            ];
            for (const insightId of insightIds) {
               queryClient.resetQueries({
                  queryKey: orpc.insights.getById.queryKey({
                     input: { id: insightId },
                  }),
               });
            }
            queryClient.invalidateQueries({
               queryKey: orpc.analytics.getDashboardInsights.queryKey({
                  input: { dashboardId: dashboard.id },
               }),
            });
            queryClient.invalidateQueries({
               queryKey: orpc.analytics.getDefaultDashboard.queryKey(),
            });
            queryClient.invalidateQueries({
               queryKey: orpc.dashboards.getById.queryKey({
                  input: { id: dashboard.id },
               }),
            });
         },
      }),
   );

   const updateFiltersMutation = useMutation(
      orpc.dashboards.updateGlobalFilters.mutationOptions({
         onSuccess: () => {
            queryClient.invalidateQueries({
               queryKey: orpc.analytics.getDefaultDashboard.queryKey(),
            });
            queryClient.invalidateQueries({
               queryKey: orpc.dashboards.getById.queryKey({
                  input: { id: dashboard.id },
               }),
            });
         },
      }),
   );

   const handleDateRangeChange = (preset: string) => {
      const dateRange: DashboardDateRange = {
         type: "relative",
         value: preset,
      };
      updateFiltersMutation.mutate({
         dashboardId: dashboard.id,
         globalDateRange: dateRange,
      });
   };

   const handleRemoveDateRange = () => {
      updateFiltersMutation.mutate({
         dashboardId: dashboard.id,
         globalDateRange: null,
      });
   };

   const handleAbsoluteRangeChange = (range: { from: Date; to: Date }) => {
      const fmt = (d: Date) =>
         `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const dateRange: DashboardDateRange = {
         type: "absolute",
         value: `${fmt(range.from)},${fmt(range.to)}`,
      };
      updateFiltersMutation.mutate({
         dashboardId: dashboard.id,
         globalDateRange: dateRange,
      });
   };

   const handleFiltersSave = (filters: Condition[]) => {
      updateFiltersMutation.mutate({
         dashboardId: dashboard.id,
         globalFilters: filters,
      });
   };

   const dateRangeLabel = useMemo(() => {
      if (!dashboard.globalDateRange) return "Sem período global";
      if (dashboard.globalDateRange.type === "absolute") {
         const parts = dashboard.globalDateRange.value.split(",");
         if (parts.length === 2) {
            const fmt = (s: string) =>
               new Date(`${s.trim()}T00:00:00`).toLocaleDateString("pt-BR", {
                  day: "numeric",
                  month: "short",
               });
            return `${fmt(parts[0])} – ${fmt(parts[1])}`;
         }
      }
      const preset = DATE_RANGE_PRESETS.find(
         (p) => p.value === dashboard.globalDateRange?.value,
      );
      return preset?.label ?? dashboard.globalDateRange.value;
   }, [dashboard.globalDateRange]);

   const absoluteDateRange = useMemo(() => {
      if (dashboard.globalDateRange?.type !== "absolute") return null;
      const parts = dashboard.globalDateRange.value.split(",");
      if (parts.length !== 2) return null;
      return {
         from: new Date(`${parts[0].trim()}T00:00:00`),
         to: new Date(`${parts[1].trim()}T23:59:59`),
      };
   }, [dashboard.globalDateRange]);

   return (
      <div className="flex items-center justify-between gap-3 border-t border-b py-2">
         <div className="flex items-center gap-1.5">
            <DateRangePicker
               clearClassName="justify-start text-destructive hover:text-destructive"
               clearIcon={<X className="size-3.5" />}
               clearLabel="Remover período global"
               heading="Período"
               label={dateRangeLabel}
               onClear={
                  dashboard.globalDateRange ? handleRemoveDateRange : undefined
               }
               onPresetSelect={handleDateRangeChange}
               onRangeSelect={handleAbsoluteRangeChange}
               presets={DATE_RANGE_PRESETS}
               selectedPreset={
                  dashboard.globalDateRange?.type === "relative"
                     ? dashboard.globalDateRange.value
                     : null
               }
               selectedRange={absoluteDateRange}
               triggerClassName={cn(
                  "h-7 text-xs",
                  dashboard.globalDateRange
                     ? "text-foreground"
                     : "text-muted-foreground",
               )}
            />

            <DashboardFilterPopover
               dashboard={dashboard}
               isPending={updateFiltersMutation.isPending}
               onSave={handleFiltersSave}
            />
         </div>

         <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {lastRefreshedTime && (
               <span className="hidden sm:inline-flex items-center gap-1">
                  <Clock className="size-3" />
                  Atualizado {lastRefreshedTime}
               </span>
            )}
            <Button
               className="h-7 text-xs gap-1.5"
               disabled={refreshMutation.isPending}
               onClick={() =>
                  refreshMutation.mutate({ dashboardId: dashboard.id })
               }
               variant="outline"
            >
               <RefreshCw
                  className={cn(
                     "size-3",
                     refreshMutation.isPending && "animate-spin",
                  )}
               />
               {refreshMutation.isPending ? "Atualizando..." : "Atualizar"}
            </Button>
         </div>
      </div>
   );
}

// =============================================================================
// Main Component
// =============================================================================

export function DashboardView({ dashboard, children }: DashboardViewProps) {
   const addInsightRef = useRef<(() => void) | null>(null);
   const saveRef = useRef<(() => void) | null>(null);
   const cancelRef = useRef<(() => void) | null>(null);
   const [isEditingLayout, setIsEditingLayout] = useState(false);
   const [isSaving, setIsSaving] = useState(false);

   const handleEnterEdit = useCallback(() => {
      if (isEditingLayout) return;
      setIsEditingLayout(true);
      toast.info("Editando o dashboard — salve para persistir as alterações", {
         id: "dashboard-edit-mode",
         duration: Number.POSITIVE_INFINITY,
      });
   }, [isEditingLayout]);

   const handleSave = useCallback(() => {
      if (!saveRef.current) return;
      setIsSaving(true);
      saveRef.current();
   }, []);

   const handleCancel = useCallback(() => {
      cancelRef.current?.();
      setIsEditingLayout(false);
      setIsSaving(false);
      toast.dismiss("dashboard-edit-mode");
   }, []);

   return (
      <main className="flex flex-col gap-0">
         <DashboardHeader
            dashboard={dashboard}
            isEditingLayout={isEditingLayout}
            isSaving={isSaving}
            onAddInsight={() => addInsightRef.current?.()}
            onCancel={handleCancel}
            onEnterEdit={handleEnterEdit}
            onSave={handleSave}
         />
         <DashboardFilterBar dashboard={dashboard} />
         <div className="flex flex-col gap-4 pt-4">
            {children}
            <EditableDashboardGrid
               dashboard={dashboard}
               isEditingLayout={isEditingLayout}
               onCancelReady={(fn) => {
                  cancelRef.current = fn;
               }}
               onOpenAddInsight={(fn) => {
                  addInsightRef.current = fn;
               }}
               onSaveComplete={() => {
                  setIsEditingLayout(false);
                  setIsSaving(false);
                  toast.dismiss("dashboard-edit-mode");
               }}
               onSaveError={() => {
                  setIsSaving(false);
               }}
               onSaveReady={(fn) => {
                  saveRef.current = fn;
               }}
            />
         </div>
      </main>
   );
}
