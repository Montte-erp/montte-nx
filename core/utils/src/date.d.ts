export declare function getCurrentDate(timezone?: string): {
   date: string;
};
export type DateLocale = "pt-BR" | "en-US";
export declare function formatDate(
   date: Date,
   format?: string,
   options?: {
      locale?: DateLocale;
      timezone?: string;
      useUTC?: boolean;
   },
): string;
/**
 * Format a date as relative time (e.g., "just now", "5 minutes ago", "2 hours ago")
 */
export declare function formatRelativeTime(date: Date): string;
//# sourceMappingURL=date.d.ts.map
