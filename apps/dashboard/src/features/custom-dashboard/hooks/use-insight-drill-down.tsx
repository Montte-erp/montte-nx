import type { InsightConfig } from "@packages/database/schemas/dashboards";
import { z } from "zod";

// ============================================
// Schemas
// ============================================

export const drillDownContextSchema = z.object({
   dimension: z.string(),
   value: z.string(),
   label: z.string(),
});

// ============================================
// Types
// ============================================

export type DrillDownContext = z.infer<typeof drillDownContextSchema>;

// ============================================
// Functions
// ============================================

export function createDrillDownConfig(
   currentConfig: InsightConfig,
   context: DrillDownContext,
): InsightConfig {
   // Create a new config with the filter applied
   const newFilters = [
      ...currentConfig.filters,
      {
         field: context.dimension,
         operator: "equals" as const,
         value: context.value,
      },
   ];

   // Determine the best chart type for drill-down
   let chartType: InsightConfig["chartType"] = "line";
   if (currentConfig.timeGrouping) {
      chartType = "line"; // Show trends over time
   } else {
      chartType = "bar"; // Show breakdown
   }

   return {
      ...currentConfig,
      filters: newFilters,
      // For drill-down, prefer time series or breakdown view
      chartType,
      timeGrouping: currentConfig.timeGrouping || "month",
      // Remove the breakdown that was just drilled into
      breakdown: undefined,
   };
}

export function useInsightDrillDown() {
   const drillDown = (
      currentConfig: InsightConfig,
      context: DrillDownContext,
   ) => {
      return createDrillDownConfig(currentConfig, context);
   };

   return { drillDown };
}
