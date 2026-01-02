/**
 * Shared utility functions for bill-related actions
 */

/**
 * Formats a number as Brazilian Real currency
 */
export function formatCurrency(value: number): string {
	return new Intl.NumberFormat("pt-BR", {
		currency: "BRL",
		style: "currency",
	}).format(value);
}

/**
 * Formats a date in Brazilian format (DD/MM/YYYY)
 */
export function formatDate(date: Date): string {
	return new Intl.DateTimeFormat("pt-BR", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	}).format(date);
}

/**
 * Returns a human-readable period label based on days ahead
 */
export function getPeriodLabel(daysAhead: number): string {
	if (daysAhead <= 1) return "hoje";
	if (daysAhead <= 7) return "esta semana";
	if (daysAhead <= 14) return "proximas duas semanas";
	if (daysAhead <= 30) return "este mes";
	return `proximos ${daysAhead} dias`;
}
