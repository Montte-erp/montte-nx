import { addDays, addMonthsPreserveDay } from "./date-math";

export type RecurrencePattern =
   | "daily"
   | "weekly"
   | "biweekly"
   | "monthly"
   | "quarterly"
   | "semiannual"
   | "annual";

export interface RecurrenceConfig {
   pattern: RecurrencePattern;
   baseDate: Date;
}

export function getNextDueDate(
   currentDueDate: Date,
   pattern: RecurrencePattern,
): Date {
   switch (pattern) {
      case "daily":
         return addDays(currentDueDate, 1);
      case "weekly":
         return addDays(currentDueDate, 7);
      case "biweekly":
         return addDays(currentDueDate, 14);
      case "monthly":
         return addMonthsPreserveDay(currentDueDate, 1);
      case "quarterly":
         return addMonthsPreserveDay(currentDueDate, 3);
      case "semiannual":
         return addMonthsPreserveDay(currentDueDate, 6);
      case "annual":
         return addMonthsPreserveDay(currentDueDate, 12);
   }
}

export function getRecurrenceLabel(pattern: RecurrencePattern): string {
   const labels: Record<RecurrencePattern, string> = {
      annual: "Anual",
      biweekly: "Quinzenal",
      daily: "Diario",
      monthly: "Mensal",
      quarterly: "Trimestral",
      semiannual: "Semestral",
      weekly: "Semanal",
   };

   return labels[pattern];
}

export function getRecurrencePatterns(): RecurrencePattern[] {
   return ["monthly", "quarterly", "semiannual", "annual"];
}

export function getDefaultFutureOccurrences(
   pattern: RecurrencePattern,
): number {
   const defaults: Record<RecurrencePattern, number> = {
      annual: 5,
      biweekly: 24,
      daily: 30,
      monthly: 12,
      quarterly: 8,
      semiannual: 6,
      weekly: 52,
   };

   return defaults[pattern];
}

export function generateFutureDates(
   baseDate: Date,
   pattern: RecurrencePattern,
   count?: number,
): Date[] {
   const occurrences = count ?? getDefaultFutureOccurrences(pattern);
   const dates: Date[] = [];
   let currentDate = new Date(baseDate);

   for (let i = 0; i < occurrences; i++) {
      currentDate = getNextDueDate(currentDate, pattern);
      dates.push(new Date(currentDate));
   }

   return dates;
}

export function generateFutureDatesUntil(
   baseDate: Date,
   pattern: RecurrencePattern,
   untilDate: Date,
): Date[] {
   const dates: Date[] = [];
   let currentDate = new Date(baseDate);

   while (currentDate < untilDate) {
      currentDate = getNextDueDate(currentDate, pattern);
      if (currentDate <= untilDate) {
         dates.push(new Date(currentDate));
      }
   }

   return dates;
}
