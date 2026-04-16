import dayjs from "dayjs";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Condition } from "@f-o-t/condition-evaluator";
import {
   type DateRange,
   type InsightConfig,
   insightConfigSchema,
} from "@packages/analytics/types";
import type { DashboardDateRange } from "@core/database/schemas/dashboards";
import { Button } from "@packages/ui/components/button";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuSeparator,
   DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import { Skeleton } from "@packages/ui/components/skeleton";
import { cn } from "@packages/ui/lib/utils";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
   AlertCircle,
   Copy,
   Ellipsis,
   GripVertical,
   Pencil,
   RefreshCw,
   Settings2,
   Trash2,
} from "lucide-react";
import { Suspense, useRef } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { useDashboardSlugs } from "@/hooks/use-dashboard-slugs";
import { useCredenza } from "@/hooks/use-credenza";
import { orpc } from "@/integrations/orpc/client";
import { InsightEditCredenza } from "./insight-edit-credenza";
import { InsightPreview } from "./insight-preview";

export type TileSize = "sm" | "md" | "lg" | "full";

interface DashboardTileProps {
   id: string;
   insightName?: string;
   size: TileSize;
   children?: React.ReactNode;
   insightId?: string;
   isEditing?: boolean;
   isResizing?: boolean;
   onRemove?: () => void;
   onDuplicate?: () => void;
   onResizePreview?: (deltaX: number, startSize: TileSize) => void;
   onResizeCommit?: () => void;
   globalFilters?: Condition[];
   globalDateRange?: DashboardDateRange;
}

const sizeClasses = {
   sm: "col-span-12 md:col-span-3",
   md: "col-span-12 md:col-span-6",
   lg: "col-span-12 md:col-span-9",
   full: "col-span-12",
};

function TileLoadingSkeleton() {
   return (
      <div className="space-y-3 p-1">
         <Skeleton className="h-3 w-24" />
         <Skeleton className="h-5 w-2/3" />
         <Skeleton className="h-3 w-1/2" />
         <Skeleton className="h-[200px] w-full" />
      </div>
   );
}

function TileErrorState({ error }: { error: Error }) {
   return (
      <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
         <AlertCircle className="size-5 text-destructive/60" />
         <p className="text-xs text-center">{error.message}</p>
      </div>
   );
}

/**
 * Converts a dashboard date range to an analytics DateRange.
 * Supports both relative ranges and absolute date ranges.
 */
function toAnalyticsDateRange(dr: DashboardDateRange): DateRange | undefined {
   if (dr.type === "relative") {
      const validValues = [
         "7d",
         "14d",
         "30d",
         "90d",
         "180d",
         "12m",
         "this_month",
         "last_month",
         "this_quarter",
         "this_year",
      ] as const;
      type ValidValue = (typeof validValues)[number];
      if (!validValues.includes(dr.value as ValidValue)) return undefined;
      return { type: "relative", value: dr.value as ValidValue };
   }

   if (dr.type === "absolute") {
      const parts = dr.value.split(",");
      if (parts.length !== 2) return undefined;
      const startStr = parts[0].trim();
      const endStr = parts[1].trim();
      const start = new Date(`${startStr}T00:00:00.000Z`);
      const end = new Date(`${endStr}T23:59:59.999Z`);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))
         return undefined;
      return {
         type: "absolute",
         start: start.toISOString(),
         end: end.toISOString(),
      };
   }

   return undefined;
}

/**
 * Merges global dashboard filters and date range into an insight config.
 * Global date range overrides the insight's own date range when set.
 * Note: ERP insight configs use TransactionFilters, not event-based Filter[].
 * Global dashboard conditions are not applied to ERP configs as they use
 * different filter structures (categoryIds, bankAccountIds, transactionType).
 */
function mergeGlobalFilters(
   config: InsightConfig,
   _globalFilters?: Condition[],
   globalDateRange?: DashboardDateRange,
): InsightConfig {
   const analyticsDateRange = globalDateRange
      ? toAnalyticsDateRange(globalDateRange)
      : undefined;

   if (!analyticsDateRange) return config;

   return {
      ...config,
      filters: {
         ...config.filters,
         dateRange: analyticsDateRange,
      },
   } as InsightConfig;
}

function DashboardInsightContent({
   insightId,
   globalFilters,
   globalDateRange,
}: {
   insightId: string;
   globalFilters?: Condition[];
   globalDateRange?: DashboardDateRange;
}) {
   const { data: insight } = useSuspenseQuery(
      orpc.insights.getById.queryOptions({
         input: { id: insightId },
      }),
   );

   const parsed = insightConfigSchema.safeParse(insight.config);
   if (!parsed.success) {
      return (
         <TileErrorState
            error={
               new Error("Configuração do insight inválida ou desatualizada")
            }
         />
      );
   }

   const config = mergeGlobalFilters(
      parsed.data,
      globalFilters,
      globalDateRange,
   );

   return <InsightPreview config={config} />;
}

function InsightTileMeta({
   insightId,
   insightName,
   globalDateRange,
}: {
   insightId: string;
   insightName?: string;
   globalDateRange?: DashboardDateRange;
}) {
   const { data: insight } = useSuspenseQuery(
      orpc.insights.getById.queryOptions({ input: { id: insightId } }),
   );

   const name = insightName || insight.name || "";
   const description = insight.description || "";
   const type = insight.type || "kpi";

   const typeLabel =
      type === "kpi"
         ? "KPI"
         : type === "time_series"
           ? "SÉRIE TEMPORAL"
           : type === "breakdown"
             ? "DISTRIBUIÇÃO"
             : "INSIGHT";

   const config = insight.config as Record<string, unknown> | undefined;
   const dateRange = config?.dateRange as
      | { type: string; value: string }
      | undefined;
   const effectiveDateRange = globalDateRange ?? dateRange;
   const dateRangeLabel = effectiveDateRange?.value
      ? formatDateRange(effectiveDateRange.value)
      : "ÚLTIMOS 30 DIAS";

   return (
      <div className="min-w-0 flex-1 space-y-1">
         <p className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
            {typeLabel} &bull; {dateRangeLabel}
         </p>
         <h3 className="text-sm font-semibold leading-snug">{name}</h3>
         {description && (
            <p className="text-xs text-muted-foreground leading-relaxed">
               {description}
            </p>
         )}
      </div>
   );
}

function InsightRefreshMenuItem({
   insightId,
   onRefresh,
}: {
   insightId: string;
   onRefresh: () => void;
}) {
   const { data: insight } = useSuspenseQuery(
      orpc.insights.getById.queryOptions({ input: { id: insightId } }),
   );

   const lastComputedAt = insight.lastComputedAt ?? null;

   return (
      <DropdownMenuItem onClick={onRefresh}>
         <RefreshCw className="mr-2 size-4" />
         <div className="flex flex-col">
            <span>Atualizar dados</span>
            {lastComputedAt && (
               <span className="text-[11px] text-muted-foreground">
                  {formatLastComputed(new Date(lastComputedAt))}
               </span>
            )}
         </div>
      </DropdownMenuItem>
   );
}

function formatDateRange(value: string): string {
   switch (value) {
      case "7d":
         return "ÚLTIMOS 7 DIAS";
      case "14d":
         return "ÚLTIMOS 14 DIAS";
      case "30d":
         return "ÚLTIMOS 30 DIAS";
      case "90d":
         return "ÚLTIMOS 90 DIAS";
      case "this_month":
         return "ESTE MÊS";
      case "last_month":
         return "MÊS PASSADO";
      case "this_year":
         return "ESTE ANO";
      default: {
         // Handle absolute "YYYY-MM-DD,YYYY-MM-DD" format
         const parts = value.split(",");
         if (parts.length === 2) {
            const fmt = (s: string) =>
               new Date(`${s.trim()}T00:00:00`).toLocaleDateString("pt-BR", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
               });
            return `${fmt(parts[0])} – ${fmt(parts[1])}`;
         }
         return value.toUpperCase();
      }
   }
}

function formatLastComputed(date: Date): string {
   const now = dayjs().toDate();
   const diffMs = now.getTime() - date.getTime();
   const diffMinutes = Math.floor(diffMs / 60000);

   if (diffMinutes < 1) return "Atualizado agora";
   if (diffMinutes < 60) return `Atualizado há ${diffMinutes}min`;

   const diffHours = Math.floor(diffMinutes / 60);
   if (diffHours < 24) return `Atualizado há ${diffHours}h`;

   const diffDays = Math.floor(diffHours / 24);
   return `Atualizado há ${diffDays}d`;
}

export function DashboardTile({
   id,
   insightName,
   size,
   children,
   insightId,
   isEditing = false,
   isResizing = false,
   onRemove,
   onDuplicate,
   onResizePreview,
   onResizeCommit,
   globalFilters,
   globalDateRange,
}: DashboardTileProps) {
   const queryClient = useQueryClient();
   const { openCredenza } = useCredenza();
   const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
   } = useSortable({ id, disabled: !isEditing });
   const resizeStartX = useRef(0);
   const resizeStartSize = useRef<TileSize>(size);
   const style = {
      transform: CSS.Transform.toString(transform),
      transition,
   };

   const { slug, teamSlug } = useDashboardSlugs();

   const handleRefresh = () => {
      if (!insightId) return;
      queryClient.resetQueries({
         queryKey: orpc.insights.getById.queryKey({
            input: { id: insightId },
         }),
      });
   };

   return (
      <div
         className={cn(sizeClasses[size], isDragging && "opacity-50 z-10")}
         ref={setNodeRef}
         style={style}
      >
         <div
            className={cn(
               "h-full rounded-lg border bg-card text-card-foreground relative",
               isResizing && "ring-2 ring-primary/50",
            )}
         >
            {/* Card header — PostHog style */}
            <div className="px-4 pt-4 pb-2">
               <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                     {isEditing && (
                        <Button
                           tooltip="Mover"
                           type="button"
                           variant="outline"
                           {...attributes}
                           {...listeners}
                        >
                           <GripVertical className="size-4" />
                        </Button>
                     )}
                     {insightId ? (
                        <Suspense
                           fallback={
                              <div className="min-w-0 flex-1 space-y-1">
                                 <Skeleton className="h-3 w-20" />
                                 <Skeleton className="h-4 w-36" />
                              </div>
                           }
                        >
                           <InsightTileMeta
                              globalDateRange={globalDateRange}
                              insightId={insightId}
                              insightName={insightName}
                           />
                        </Suspense>
                     ) : (
                        <div className="min-w-0 flex-1 space-y-1">
                           <p className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                              INSIGHT
                           </p>
                           <h3 className="text-sm font-semibold leading-snug">
                              {insightName ?? ""}
                           </h3>
                        </div>
                     )}
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                           <Button className="size-6" variant="outline">
                              <Ellipsis className="size-3.5" />
                           </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                           {/* Edit insight */}
                           {insightId && (
                              <DropdownMenuItem asChild>
                                 <Link
                                    params={{
                                       insightId,
                                       slug,
                                       teamSlug,
                                    }}
                                    to="/$slug/$teamSlug/analytics/insights/$insightId"
                                 >
                                    <Pencil className="mr-2 size-4" />
                                    Editar
                                 </Link>
                              </DropdownMenuItem>
                           )}

                           {/* Configure insight */}
                           {insightId && (
                              <DropdownMenuItem
                                 onClick={() =>
                                    openCredenza({
                                       renderChildren: () => (
                                          <InsightEditCredenza
                                             insightId={insightId}
                                          />
                                       ),
                                    })
                                 }
                              >
                                 <Settings2 className="mr-2 size-4" />
                                 Configurar
                              </DropdownMenuItem>
                           )}

                           {/* Duplicate on dashboard */}
                           {onDuplicate && (
                              <DropdownMenuItem onClick={onDuplicate}>
                                 <Copy className="mr-2 size-4" />
                                 Duplicar
                              </DropdownMenuItem>
                           )}

                           <DropdownMenuSeparator />

                           {/* Refresh data */}
                           {insightId && (
                              <Suspense
                                 fallback={
                                    <DropdownMenuItem disabled>
                                       <RefreshCw className="mr-2 size-4" />
                                       Atualizar dados
                                    </DropdownMenuItem>
                                 }
                              >
                                 <InsightRefreshMenuItem
                                    insightId={insightId}
                                    onRefresh={handleRefresh}
                                 />
                              </Suspense>
                           )}

                           {/* Remove from dashboard */}
                           {onRemove && (
                              <>
                                 <DropdownMenuSeparator />
                                 <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={onRemove}
                                 >
                                    <Trash2 className="mr-2 size-4" />
                                    Remover do dashboard
                                 </DropdownMenuItem>
                              </>
                           )}
                        </DropdownMenuContent>
                     </DropdownMenu>
                  </div>
               </div>
            </div>

            {/* Chart / content area */}
            <div className="px-4 pb-4">
               {insightId ? (
                  <ErrorBoundary
                     fallbackRender={({ error }) => (
                        <TileErrorState error={error as Error} />
                     )}
                  >
                     <Suspense fallback={<TileLoadingSkeleton />}>
                        <DashboardInsightContent
                           globalDateRange={globalDateRange}
                           globalFilters={globalFilters}
                           insightId={insightId}
                        />
                     </Suspense>
                  </ErrorBoundary>
               ) : (
                  children
               )}
            </div>
            {/* Resize handle — right edge, pointer capture */}
            {isEditing && (
               <div
                  aria-label="Redimensionar tile"
                  className={cn(
                     "absolute right-1.5 top-1/2 -translate-y-1/2 h-12 w-4 flex items-center justify-center rounded-md",
                     "bg-muted border border-border/50 cursor-col-resize select-none touch-none",
                     "hover:bg-accent hover:border-border transition-colors",
                     isResizing &&
                        "bg-accent border-border ring-1 ring-primary/50",
                  )}
                  onPointerCancel={() => onResizeCommit?.()}
                  onPointerDown={(e) => {
                     e.preventDefault();
                     e.currentTarget.setPointerCapture(e.pointerId);
                     resizeStartX.current = e.clientX;
                     resizeStartSize.current = size;
                  }}
                  onPointerMove={(e) => {
                     if (!e.currentTarget.hasPointerCapture(e.pointerId))
                        return;
                     onResizePreview?.(
                        e.clientX - resizeStartX.current,
                        resizeStartSize.current,
                     );
                  }}
                  onPointerUp={(e) => {
                     if (!e.currentTarget.hasPointerCapture(e.pointerId))
                        return;
                     e.currentTarget.releasePointerCapture(e.pointerId);
                     onResizeCommit?.();
                  }}
                  role="separator"
               >
                  <GripVertical
                     aria-hidden="true"
                     className="size-3 text-muted-foreground"
                  />
               </div>
            )}
         </div>
      </div>
   );
}
