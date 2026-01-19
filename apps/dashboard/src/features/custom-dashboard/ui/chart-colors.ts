/**
 * Theme-aware chart colors using CSS variables.
 * These colors automatically adapt to light/dark theme changes.
 */
export const CHART_COLORS = [
   "var(--chart-1)",
   "var(--chart-2)",
   "var(--chart-3)",
   "var(--chart-4)",
   "var(--chart-5)",
   "var(--chart-6)",
   "var(--chart-7)",
   "var(--chart-8)",
   "var(--chart-9)",
   "var(--chart-10)",
] as const;

/**
 * Semantic colors for specific use cases.
 * Maps business meanings to theme-aware CSS variables.
 */
export const SEMANTIC_COLORS = {
   income: "var(--income)",
   expense: "var(--expense)",
   transfer: "var(--chart-5)",
   current: "var(--chart-1)",
   previous: "var(--muted-foreground)",
} as const;

/**
 * Get a chart color by index.
 * Colors cycle through the palette when index exceeds available colors.
 */
export function getChartColor(index: number): string {
   return CHART_COLORS[index % CHART_COLORS.length] ?? CHART_COLORS[0];
}

/**
 * Get the appropriate color for an item, falling back to chart colors if not specified.
 * @param color - Optional color from the item (e.g., category color)
 * @param index - Index for fallback color selection
 */
export function getItemColor(
   color: string | null | undefined,
   index: number,
): string {
   return color || getChartColor(index);
}
