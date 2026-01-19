"use client";

import { formatDecimalCurrency } from "@packages/money";
import {
   Tooltip,
   TooltipContent,
   TooltipProvider,
   TooltipTrigger,
} from "@packages/ui/components/tooltip";
import { cn } from "@packages/ui/lib/utils";
import { useMemo } from "react";

export type HeatmapCell = {
   x: number; // Day of week (0-6)
   y: number; // Hour of day (0-23)
   value: number;
   count: number;
};

export type HeatmapData = {
   cells: HeatmapCell[];
   maxValue: number;
};

type HeatmapChartProps = {
   data: HeatmapData;
   height?: number;
   className?: string;
   xLabels?: string[];
   yLabels?: string[];
   colorScale?: "green" | "red" | "blue";
};

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

const HOUR_LABELS = ["00h", "03h", "06h", "09h", "12h", "15h", "18h", "21h"];

const COLOR_SCALES = {
   green: {
      empty: "bg-muted/30",
      low: "bg-green-200 dark:bg-green-950",
      medium: "bg-green-400 dark:bg-green-800",
      high: "bg-green-600 dark:bg-green-600",
      max: "bg-green-800 dark:bg-green-400",
   },
   red: {
      empty: "bg-muted/30",
      low: "bg-red-200 dark:bg-red-950",
      medium: "bg-red-400 dark:bg-red-800",
      high: "bg-red-600 dark:bg-red-600",
      max: "bg-red-800 dark:bg-red-400",
   },
   blue: {
      empty: "bg-muted/30",
      low: "bg-blue-200 dark:bg-blue-950",
      medium: "bg-blue-400 dark:bg-blue-800",
      high: "bg-blue-600 dark:bg-blue-600",
      max: "bg-blue-800 dark:bg-blue-400",
   },
};

function getIntensityClass(
   value: number,
   maxValue: number,
   colorScale: "green" | "red" | "blue",
): string {
   const colors = COLOR_SCALES[colorScale];

   if (value === 0) return colors.empty;

   const ratio = value / maxValue;

   if (ratio < 0.25) return colors.low;
   if (ratio < 0.5) return colors.medium;
   if (ratio < 0.75) return colors.high;
   return colors.max;
}

export function HeatmapChart({
   data,
   height = 300,
   className,
   xLabels = DAY_LABELS,
   colorScale = "red",
}: HeatmapChartProps) {
   // Create a map for quick cell lookup
   const cellMap = useMemo(() => {
      const map = new Map<string, HeatmapCell>();
      for (const cell of data.cells) {
         map.set(`${cell.x}-${cell.y}`, cell);
      }
      return map;
   }, [data.cells]);

   // Generate 24 hour slots grouped by 3 hours for display
   const hourSlots = useMemo(() => {
      const slots: number[][] = [];
      for (let i = 0; i < 8; i++) {
         slots.push([i * 3, i * 3 + 1, i * 3 + 2]);
      }
      return slots;
   }, []);

   if (!data.cells.length) {
      return (
         <div
            className={cn(
               "flex items-center justify-center text-muted-foreground text-sm",
               className,
            )}
            style={{ height }}
         >
            Sem dados para exibir mapa de calor
         </div>
      );
   }

   return (
      <TooltipProvider delayDuration={100}>
         <div
            className={cn("w-full overflow-x-auto", className)}
            style={{ minHeight: height }}
         >
            <div className="min-w-[400px]">
               {/* Header with day labels */}
               <div className="flex gap-1 mb-2 pl-12">
                  {xLabels.map((label) => (
                     <div
                        className="flex-1 text-center text-xs text-muted-foreground"
                        key={label}
                     >
                        {label}
                     </div>
                  ))}
               </div>

               {/* Heatmap grid */}
               <div className="flex flex-col gap-1">
                  {hourSlots.map((hours, slotIndex) => (
                     <div
                        className="flex items-center gap-1"
                        key={`slot-${slotIndex + 1}`}
                     >
                        {/* Hour label */}
                        <div className="w-10 text-right text-xs text-muted-foreground pr-2">
                           {HOUR_LABELS[slotIndex]}
                        </div>

                        {/* Cells for each day */}
                        {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                           // Aggregate values for the 3 hours in this slot
                           let totalValue = 0;
                           let totalCount = 0;

                           for (const hour of hours) {
                              const cell = cellMap.get(`${day}-${hour}`);
                              if (cell) {
                                 totalValue += cell.value;
                                 totalCount += cell.count;
                              }
                           }

                           return (
                              <Tooltip key={`cell-${day}-${slotIndex + 1}`}>
                                 <TooltipTrigger asChild>
                                    <div
                                       className={cn(
                                          "flex-1 aspect-square rounded-sm cursor-pointer transition-opacity hover:opacity-80",
                                          getIntensityClass(
                                             totalValue,
                                             data.maxValue,
                                             colorScale,
                                          ),
                                       )}
                                    />
                                 </TooltipTrigger>
                                 <TooltipContent>
                                    <div className="text-xs">
                                       <p className="font-medium">
                                          {xLabels[day]}{" "}
                                          {HOUR_LABELS[slotIndex]} -{" "}
                                          {(hours[2] ?? 0) + 1}h
                                       </p>
                                       {totalCount > 0 ? (
                                          <>
                                             <p>
                                                {formatDecimalCurrency(
                                                   totalValue,
                                                )}
                                             </p>
                                             <p className="text-muted-foreground">
                                                {totalCount} transacao
                                                {totalCount > 1 ? "es" : ""}
                                             </p>
                                          </>
                                       ) : (
                                          <p className="text-muted-foreground">
                                             Sem transacoes
                                          </p>
                                       )}
                                    </div>
                                 </TooltipContent>
                              </Tooltip>
                           );
                        })}
                     </div>
                  ))}
               </div>

               {/* Legend */}
               <div className="flex items-center justify-center gap-2 mt-4">
                  <span className="text-xs text-muted-foreground">Menos</span>
                  <div className="flex gap-1">
                     {["empty", "low", "medium", "high", "max"].map((level) => (
                        <div
                           className={cn(
                              "w-4 h-4 rounded-sm",
                              COLOR_SCALES[colorScale][
                                 level as keyof typeof COLOR_SCALES.green
                              ],
                           )}
                           key={level}
                        />
                     ))}
                  </div>
                  <span className="text-xs text-muted-foreground">Mais</span>
               </div>
            </div>
         </div>
      </TooltipProvider>
   );
}

/**
 * Transform transaction data into heatmap format
 * Shows spending intensity by day of week and hour
 */
export function transformToHeatmapData(
   transactions: Array<{ date: Date; amount: number }>,
): HeatmapData {
   const cellMap = new Map<string, { value: number; count: number }>();
   let maxValue = 0;

   for (const tx of transactions) {
      const date = new Date(tx.date);
      const dayOfWeek = date.getDay();
      const hour = date.getHours();
      const key = `${dayOfWeek}-${hour}`;

      const existing = cellMap.get(key) || { value: 0, count: 0 };
      existing.value += Math.abs(tx.amount);
      existing.count += 1;
      cellMap.set(key, existing);

      if (existing.value > maxValue) {
         maxValue = existing.value;
      }
   }

   const cells: HeatmapCell[] = [];

   for (const [key, data] of cellMap.entries()) {
      const [x, y] = key.split("-").map(Number);
      cells.push({
         x: x ?? 0,
         y: y ?? 0,
         value: data.value,
         count: data.count,
      });
   }

   return { cells, maxValue };
}
