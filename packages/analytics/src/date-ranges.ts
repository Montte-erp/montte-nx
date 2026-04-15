import dayjs from "dayjs";
import quarterOfYear from "dayjs/plugin/quarterOfYear";
import type { DateRange } from "./types";

dayjs.extend(quarterOfYear);

export interface ResolvedDateRange {
   start: Date;
   end: Date;
}

export interface ResolvedDateRangeWithComparison extends ResolvedDateRange {
   previous: ResolvedDateRange;
}

export function resolveDateRange(dateRange: DateRange): ResolvedDateRange {
   if (dateRange.type === "absolute") {
      return {
         start: new Date(dateRange.start),
         end: new Date(dateRange.end),
      };
   }

   const now = dayjs();
   const end = now.add(1, "day").startOf("day").toDate();

   switch (dateRange.value) {
      case "7d":
         return { start: now.subtract(7, "day").startOf("day").toDate(), end };
      case "14d":
         return { start: now.subtract(14, "day").startOf("day").toDate(), end };
      case "30d":
         return { start: now.subtract(30, "day").startOf("day").toDate(), end };
      case "90d":
         return { start: now.subtract(90, "day").startOf("day").toDate(), end };
      case "180d":
         return {
            start: now.subtract(180, "day").startOf("day").toDate(),
            end,
         };
      case "12m":
         return {
            start: now.subtract(12, "month").startOf("day").toDate(),
            end,
         };
      case "this_month":
         return { start: now.startOf("month").toDate(), end };
      case "last_month": {
         const lastMonth = now.subtract(1, "month");
         return {
            start: lastMonth.startOf("month").toDate(),
            end: now.startOf("month").toDate(),
         };
      }
      case "this_quarter":
         return { start: now.startOf("quarter").toDate(), end };
      case "this_year":
         return { start: now.startOf("year").toDate(), end };
   }
}

export function resolveDateRangeWithComparison(
   dateRange: DateRange,
): ResolvedDateRangeWithComparison {
   const resolved = resolveDateRange(dateRange);
   const durationMs = resolved.end.getTime() - resolved.start.getTime();

   const previous: ResolvedDateRange = {
      start: new Date(resolved.start.getTime() - durationMs),
      end: new Date(resolved.end.getTime() - durationMs),
   };

   return {
      ...resolved,
      previous,
   };
}
