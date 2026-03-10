import dayjs from "dayjs";

/**
 * Computes which statement period (YYYY-MM) a purchase falls into.
 * If purchase date <= closing day → same month.
 * If purchase date > closing day → next month.
 */
export function computeStatementPeriod(
   purchaseDate: string,
   closingDay: number,
): string {
   const date = dayjs(purchaseDate);
   if (date.date() <= closingDay) {
      return date.format("YYYY-MM");
   }
   return date.add(1, "month").format("YYYY-MM");
}

/**
 * Computes the closing date for a statement period.
 * Clamps to the last day of the month if closingDay exceeds it.
 */
export function computeClosingDate(
   statementPeriod: string,
   closingDay: number,
): string {
   const date = dayjs(`${statementPeriod}-01`);
   const lastDay = date.daysInMonth();
   const clampedDay = Math.min(closingDay, lastDay);
   return date.date(clampedDay).format("YYYY-MM-DD");
}

/**
 * Computes the due date for a statement period.
 * If dueDay < closingDay, the due date falls in the next month.
 * Clamps to last day of the target month.
 */
export function computeDueDate(
   statementPeriod: string,
   closingDay: number,
   dueDay: number,
): string {
   const base = dayjs(`${statementPeriod}-01`);
   const targetMonth = dueDay < closingDay ? base.add(1, "month") : base;
   const lastDay = targetMonth.daysInMonth();
   const clampedDay = Math.min(dueDay, lastDay);
   return targetMonth.date(clampedDay).format("YYYY-MM-DD");
}
