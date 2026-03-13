export type TimePeriod =
   | "all-time"
   | "today"
   | "yesterday"
   | "this-week"
   | "this-month"
   | "last-month"
   | "this-year"
   | "custom";
export interface TimePeriodDateRange {
   startDate: Date | null;
   endDate: Date | null;
   selectedMonth: Date;
}
export interface TimePeriodChipsProps {
   value: TimePeriod | null;
   onValueChange: (
      value: TimePeriod | null,
      dateRange: TimePeriodDateRange,
   ) => void;
   className?: string;
   disabled?: boolean;
   size?: "sm" | "default" | "lg";
   scrollable?: boolean;
}
declare const PERIODS: {
   value: TimePeriod;
   label: string;
   shortLabel: string;
   icon: React.ComponentType<{
      className?: string;
   }>;
}[];
export declare function getDateRangeForPeriod(
   period: TimePeriod,
): TimePeriodDateRange;
export declare function TimePeriodChips({
   value,
   onValueChange,
   className,
   disabled,
   size,
   scrollable,
}: TimePeriodChipsProps): import("react/jsx-runtime").JSX.Element;
export { PERIODS as TIME_PERIODS };
//# sourceMappingURL=time-period-chips.d.ts.map
