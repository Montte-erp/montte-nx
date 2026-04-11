export const BUDGET_ALERTS_QUEUE = "budget-alerts";

export interface BudgetAlertJobData {
   teamId: string;
   month: number;
   year: number;
}
