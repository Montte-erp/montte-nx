/**
 * Theme-aware chart colors using CSS variables.
 * These colors automatically adapt to light/dark theme changes.
 */
export const CHART_COLORS = [
   "hsl(var(--chart-1))",
   "hsl(var(--chart-2))",
   "hsl(var(--chart-3))",
   "hsl(var(--chart-4))",
   "hsl(var(--chart-5))",
   "hsl(var(--chart-6))",
   "hsl(var(--chart-7))",
   "hsl(var(--chart-8))",
   "hsl(var(--chart-9))",
   "hsl(var(--chart-10))",
] as const;

/**
 * Semantic colors for specific use cases.
 * Maps business meanings to theme-aware CSS variables.
 */
export const SEMANTIC_COLORS = {
   income: "hsl(var(--chart-2))",
   expense: "hsl(var(--destructive))",
   transfer: "hsl(var(--chart-5))",
   current: "hsl(var(--chart-1))",
   previous: "hsl(var(--muted-foreground))",
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
