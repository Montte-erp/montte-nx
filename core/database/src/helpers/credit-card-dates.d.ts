/**
 * Computes which statement period (YYYY-MM) a purchase falls into.
 * If purchase date <= closing day → same month.
 * If purchase date > closing day → next month.
 */
export declare function computeStatementPeriod(
   purchaseDate: string,
   closingDay: number,
): string;
/**
 * Computes the closing date for a statement period.
 * Clamps to the last day of the month if closingDay exceeds it.
 */
export declare function computeClosingDate(
   statementPeriod: string,
   closingDay: number,
): string;
/**
 * Computes the due date for a statement period.
 * If dueDay < closingDay, the due date falls in the next month.
 * Clamps to last day of the target month.
 */
export declare function computeDueDate(
   statementPeriod: string,
   closingDay: number,
   dueDay: number,
): string;
//# sourceMappingURL=credit-card-dates.d.ts.map
