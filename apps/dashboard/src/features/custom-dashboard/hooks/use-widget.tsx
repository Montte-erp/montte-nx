import type { WidgetPosition } from "@packages/database/schemas/dashboards";
import { z } from "zod";

// ============================================
// Schemas
// ============================================

export const widgetTypeSchema = z.enum([
   "insight",
   "text_card",
   "anomaly_card",
]);

export const widgetSchema = z.object({
   id: z.string(),
   dashboardId: z.string(),
   type: widgetTypeSchema,
   name: z.string(),
   description: z.string().nullable(),
   position: z.custom<WidgetPosition>(),
   config: z.unknown(),
});

// ============================================
// Types
// ============================================

export type WidgetType = z.infer<typeof widgetTypeSchema>;
export type Widget = z.infer<typeof widgetSchema>;

// ============================================
// Hook
// ============================================

export function useWidget() {
   const getColSpanClass = (width: number) => {
      const colSpanMap: Record<number, string> = {
         1: "md:col-span-1",
         2: "md:col-span-2",
         3: "md:col-span-3",
         4: "md:col-span-4",
         5: "md:col-span-5",
         6: "md:col-span-6",
      };
      return colSpanMap[width] || "md:col-span-3";
   };

   const getWidthLimits = (type: WidgetType) => {
      const isTextCard = type === "text_card";
      return {
         minWidth: isTextCard ? 1 : 3,
         maxWidth: isTextCard ? 3 : 6,
      };
   };

   return {
      getColSpanClass,
      getWidthLimits,
   };
}

// ============================================
// Static helpers (for use outside React)
// ============================================

export function getColSpanClass(width: number) {
   const colSpanMap: Record<number, string> = {
      1: "md:col-span-1",
      2: "md:col-span-2",
      3: "md:col-span-3",
      4: "md:col-span-4",
      5: "md:col-span-5",
      6: "md:col-span-6",
   };
   return colSpanMap[width] || "md:col-span-3";
}

export function getWidthLimits(type: WidgetType) {
   const isTextCard = type === "text_card";
   return {
      minWidth: isTextCard ? 1 : 3,
      maxWidth: isTextCard ? 3 : 6,
   };
}
