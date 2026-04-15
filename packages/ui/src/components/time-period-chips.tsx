"use client";

import { cn } from "@packages/ui/lib/utils";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";

dayjs.extend(isoWeek);
import {
   Calendar,
   CalendarDays,
   CalendarRange,
   Clock,
   History,
   Infinity as InfinityIcon,
} from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "./toggle-group";

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

const PERIODS: {
   value: TimePeriod;
   label: string;
   shortLabel: string;
   icon: React.ComponentType<{ className?: string }>;
}[] = [
   { icon: Clock, label: "Hoje", shortLabel: "Hoje", value: "today" },
   { icon: History, label: "Ontem", shortLabel: "Ontem", value: "yesterday" },
   {
      icon: CalendarRange,
      label: "Esta Semana",
      shortLabel: "Semana",
      value: "this-week",
   },
   {
      icon: CalendarDays,
      label: "Este Mês",
      shortLabel: "Mês",
      value: "this-month",
   },
   {
      icon: History,
      label: "Mês Passado",
      shortLabel: "Anterior",
      value: "last-month",
   },
   {
      icon: Calendar,
      label: "Este Ano",
      shortLabel: "Ano",
      value: "this-year",
   },
   {
      icon: InfinityIcon,
      label: "Todo Período",
      shortLabel: "Todos",
      value: "all-time",
   },
];

export function getDateRangeForPeriod(period: TimePeriod): TimePeriodDateRange {
   const today = dayjs();

   switch (period) {
      case "all-time":
         return {
            endDate: null,
            selectedMonth: today.toDate(),
            startDate: null,
         };
      case "today":
         return {
            endDate: today.endOf("day").toDate(),
            selectedMonth: today.toDate(),
            startDate: today.startOf("day").toDate(),
         };
      case "yesterday": {
         const yesterday = today.subtract(1, "day");
         return {
            endDate: yesterday.endOf("day").toDate(),
            selectedMonth: yesterday.toDate(),
            startDate: yesterday.startOf("day").toDate(),
         };
      }
      case "this-week":
         return {
            endDate: today.endOf("isoWeek").toDate(),
            selectedMonth: today.toDate(),
            startDate: today.startOf("isoWeek").toDate(),
         };
      case "this-month":
         return {
            endDate: today.endOf("month").toDate(),
            selectedMonth: today.toDate(),
            startDate: today.startOf("month").toDate(),
         };
      case "last-month": {
         const lastMonth = today.subtract(1, "month");
         return {
            endDate: lastMonth.endOf("month").toDate(),
            selectedMonth: lastMonth.toDate(),
            startDate: lastMonth.startOf("month").toDate(),
         };
      }
      case "this-year":
         return {
            endDate: today.endOf("year").toDate(),
            selectedMonth: today.toDate(),
            startDate: today.startOf("year").toDate(),
         };
      case "custom":
         return {
            endDate: null,
            selectedMonth: today.toDate(),
            startDate: null,
         };
      default:
         return {
            endDate: null,
            selectedMonth: today.toDate(),
            startDate: null,
         };
   }
}

export function TimePeriodChips({
   value,
   onValueChange,
   className,
   disabled = false,
   size = "default",
   scrollable = false,
}: TimePeriodChipsProps) {
   const handleValueChange = (newValue: string) => {
      if (!newValue) {
         onValueChange(null, {
            endDate: null,
            selectedMonth: dayjs().toDate(),
            startDate: null,
         });
         return;
      }

      const period = newValue as TimePeriod;
      const dateRange = getDateRangeForPeriod(period);
      onValueChange(period, dateRange);
   };

   return (
      <ToggleGroup
         className={cn(
            "justify-start",
            scrollable
               ? "flex-nowrap overflow-x-auto scrollbar-none"
               : "flex-wrap",
            className,
         )}
         disabled={disabled}
         onValueChange={handleValueChange}
         size={size}
         spacing={2}
         type="single"
         value={value || ""}
         variant="outline"
      >
         {PERIODS.map((period) => {
            const Icon = period.icon;
            return (
               <ToggleGroupItem
                  aria-label={`Toggle ${period.value}`}
                  className={cn(
                     "gap-1.5 shrink-0 data-[state=on]:bg-transparent data-[state=on]:text-primary data-[state=on]:*:[svg]:stroke-primary",
                     size === "sm" && "text-xs px-2 h-7",
                  )}
                  key={period.value}
                  value={period.value}
               >
                  <Icon className={cn("size-3.5", size === "sm" && "size-3")} />
                  <span className="hidden sm:inline">{period.label}</span>
                  <span className="sm:hidden">{period.shortLabel}</span>
               </ToggleGroupItem>
            );
         })}
      </ToggleGroup>
   );
}

export { PERIODS as TIME_PERIODS };
