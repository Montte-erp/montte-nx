import {
   endOfDay,
   endOfMonth,
   endOfQuarter,
   endOfYear,
   startOfDay,
   startOfMonth,
   startOfQuarter,
   startOfYear,
   subDays,
   subMonths,
   subYears,
} from "date-fns";

export type RelativePeriod =
   | "last_7_days"
   | "last_30_days"
   | "last_90_days"
   | "this_month"
   | "last_month"
   | "this_quarter"
   | "this_year"
   | "last_year"
   | "custom";

type DateRange = {
   startDate: string;
   endDate: string;
};

/**
 * Resolves a relative period to actual ISO date strings.
 * This is used to convert widget-level date range overrides
 * to concrete dates before making API calls.
 */
export function resolveDateRange(
   relativePeriod: RelativePeriod,
   customStart?: Date | null,
   customEnd?: Date | null,
): DateRange {
   const today = new Date();
   let startDate: Date;
   let endDate: Date;

   switch (relativePeriod) {
      case "last_7_days":
         startDate = startOfDay(subDays(today, 7));
         endDate = endOfDay(today);
         break;

      case "last_30_days":
         startDate = startOfDay(subDays(today, 30));
         endDate = endOfDay(today);
         break;

      case "last_90_days":
         startDate = startOfDay(subDays(today, 90));
         endDate = endOfDay(today);
         break;

      case "this_month":
         startDate = startOfMonth(today);
         endDate = endOfMonth(today);
         break;

      case "last_month": {
         const lastMonth = subMonths(today, 1);
         startDate = startOfMonth(lastMonth);
         endDate = endOfMonth(lastMonth);
         break;
      }

      case "this_quarter":
         startDate = startOfQuarter(today);
         endDate = endOfQuarter(today);
         break;

      case "this_year":
         startDate = startOfYear(today);
         endDate = endOfYear(today);
         break;

      case "last_year": {
         const lastYear = subYears(today, 1);
         startDate = startOfYear(lastYear);
         endDate = endOfYear(lastYear);
         break;
      }

      case "custom":
         startDate = customStart ?? startOfDay(subDays(today, 30));
         endDate = customEnd ?? endOfDay(today);
         break;

      default:
         startDate = startOfDay(subDays(today, 30));
         endDate = endOfDay(today);
   }

   return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
   };
}
