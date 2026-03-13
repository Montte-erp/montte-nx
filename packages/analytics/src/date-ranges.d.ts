import type { DateRange } from "./types";
export interface ResolvedDateRange {
   start: Date;
   end: Date;
}
export interface ResolvedDateRangeWithComparison extends ResolvedDateRange {
   previous: ResolvedDateRange;
}
export declare function resolveDateRange(
   dateRange: DateRange,
): ResolvedDateRange;
export declare function resolveDateRangeWithComparison(
   dateRange: DateRange,
): ResolvedDateRangeWithComparison;
//# sourceMappingURL=date-ranges.d.ts.map
