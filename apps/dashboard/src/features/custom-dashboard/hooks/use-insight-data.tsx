import { z } from "zod";

// ============================================
// Schemas
// ============================================

export const insightBreakdownItemSchema = z.object({
   id: z.string().optional(),
   label: z.string(),
   value: z.number(),
   color: z.string().optional(),
});

export const insightTimeSeriesPointSchema = z.object({
   date: z.string(),
   value: z.number(),
   incomeValue: z.number().optional(),
   expenseValue: z.number().optional(),
});

export const insightComparisonSchema = z.object({
   previousValue: z.number(),
   change: z.number(),
   changePercent: z.number(),
});

export const insightDataSchema = z.object({
   value: z.number(),
   comparison: insightComparisonSchema.optional(),
   breakdown: z.array(insightBreakdownItemSchema).optional(),
   timeSeries: z.array(insightTimeSeriesPointSchema).optional(),
   comparisonTimeSeries: z.array(insightTimeSeriesPointSchema).optional(),
   tableData: z.array(z.record(z.string(), z.unknown())).optional(),
});

// ============================================
// Types
// ============================================

export type InsightBreakdownItem = z.infer<typeof insightBreakdownItemSchema>;
export type InsightTimeSeriesPoint = z.infer<
   typeof insightTimeSeriesPointSchema
>;
export type InsightComparison = z.infer<typeof insightComparisonSchema>;
export type InsightData = z.infer<typeof insightDataSchema>;

// ============================================
// Hook
// ============================================

export function useInsightData() {
   const formatRelativeTime = (date: Date | string): string => {
      const d = new Date(date);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);

      if (diffMins < 1) return "just now";
      if (diffMins < 60) return `${diffMins} min ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24)
         return `${diffHours} hr${diffHours > 1 ? "s" : ""} ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
      const diffWeeks = Math.floor(diffDays / 7);
      if (diffWeeks < 5)
         return `${diffWeeks} week${diffWeeks > 1 ? "s" : ""} ago`;
      const diffMonths = Math.floor(diffDays / 30);
      if (diffMonths < 12)
         return `${diffMonths} month${diffMonths > 1 ? "s" : ""} ago`;
      return d.toLocaleDateString();
   };

   return {
      formatRelativeTime,
   };
}

// ============================================
// Static helpers (for use outside React)
// ============================================

export function formatRelativeTime(date: Date | string): string {
   const d = new Date(date);
   const now = new Date();
   const diffMs = now.getTime() - d.getTime();
   const diffMins = Math.floor(diffMs / 60000);

   if (diffMins < 1) return "just now";
   if (diffMins < 60) return `${diffMins} min ago`;
   const diffHours = Math.floor(diffMins / 60);
   if (diffHours < 24) return `${diffHours} hr${diffHours > 1 ? "s" : ""} ago`;
   const diffDays = Math.floor(diffHours / 24);
   if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
   const diffWeeks = Math.floor(diffDays / 7);
   if (diffWeeks < 5) return `${diffWeeks} week${diffWeeks > 1 ? "s" : ""} ago`;
   const diffMonths = Math.floor(diffDays / 30);
   if (diffMonths < 12)
      return `${diffMonths} month${diffMonths > 1 ? "s" : ""} ago`;
   return d.toLocaleDateString();
}
