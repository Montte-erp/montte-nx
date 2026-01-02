/**
 * Adds months to a date while preserving the target day-of-month.
 * If the target day doesn't exist in the result month, clamps to last day.
 *
 * Examples:
 * - Jan 31 + 1 month = Feb 28 (or 29 in leap year)
 * - Jan 15 + 1 month = Feb 15
 * - Mar 31 + 1 month = Apr 30
 */
export function addMonthsPreserveDay(date: Date, months: number): Date {
   const targetDay = date.getDate();
   const result = new Date(date);

   // Move to the 1st to avoid overflow during month change
   result.setDate(1);
   result.setMonth(result.getMonth() + months);

   // Get the last day of the target month
   const lastDayOfMonth = new Date(
      result.getFullYear(),
      result.getMonth() + 1,
      0,
   ).getDate();

   // Set to target day or last day of month, whichever is smaller
   result.setDate(Math.min(targetDay, lastDayOfMonth));

   return result;
}

/**
 * Adds days to a date, handling month/year boundaries correctly.
 */
export function addDays(date: Date, days: number): Date {
   const result = new Date(date);
   result.setDate(result.getDate() + days);
   return result;
}

/**
 * Calculates installment dates preserving day-of-month when interval is ~30 days.
 * For non-monthly intervals (7, 14, 15 days), uses simple day addition.
 *
 * @param baseDueDate - The first installment's due date
 * @param totalInstallments - Number of installments to generate
 * @param intervalDays - Days between installments (30 = monthly with day preservation)
 */
export function calculateInstallmentDates(
   baseDueDate: Date,
   totalInstallments: number,
   intervalDays: number,
): Date[] {
   const dates: Date[] = [];
   const isMonthlyInterval = intervalDays === 30;

   for (let i = 0; i < totalInstallments; i++) {
      if (isMonthlyInterval) {
         dates.push(addMonthsPreserveDay(baseDueDate, i));
      } else {
         dates.push(addDays(baseDueDate, i * intervalDays));
      }
   }

   return dates;
}
