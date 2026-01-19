// Report types
export type ReportType =
   | "bank_statement"
   | "dre_gerencial"
   | "dre_fiscal"
   | "balance_sheet"
   | "cash_flow"
   | "category_breakdown"
   | "budget_vs_actual";

// Report types that have PDF templates implemented
export type SupportedPdfReportType = "dre_gerencial" | "dre_fiscal";

// Type guard to check if a report type has a PDF template
export function isSupportedPdfReportType(
   type: ReportType,
): type is SupportedPdfReportType {
   return type === "dre_gerencial" || type === "dre_fiscal";
}

// DRE line item for income statement
export type DRELineItem = {
   code: string;
   label: string;
   value: number;
   plannedValue?: number;
   variance?: number;
   indent: number;
   isTotal: boolean;
};

// Category snapshot for reports
export type CategorySnapshot = {
   id: string;
   name: string;
   color: string;
   parentId?: string | null;
};

// Category split for transaction snapshots
export type CategorySplitSnapshot = {
   categoryId: string;
   value: number;
   percentage: number;
};

// Transaction category junction
export type TransactionCategorySnapshot = {
   category: CategorySnapshot;
};

// Transaction snapshot for reports
export type TransactionSnapshot = {
   id: string;
   date: string;
   description: string;
   amount: string;
   type: "income" | "expense";
   bankAccountId?: string | null;
   transactionCategories: TransactionCategorySnapshot[];
   categorySplits?: CategorySplitSnapshot[];
};

// Filter metadata for reports
export type FilterMetadata = {
   bankAccounts?: Array<{ id: string; name: string }>;
   categories?: Array<{ id: string; name: string }>;
   costCenters?: Array<{ id: string; name: string }>;
   tags?: Array<{ id: string; name: string }>;
};

// Summary data for reports
export type SummaryData = {
   totalIncome: number;
   totalExpense: number;
   totalExpenses: number; // Alias for compatibility
   netIncome: number;
   netResult: number; // Alias for compatibility
   transactionCount: number;
};

// DRE snapshot data
export type DRESnapshotData = {
   summary: SummaryData;
   dreLines: DRELineItem[];
   transactions: TransactionSnapshot[];
   filterMetadata?: FilterMetadata;
   generatedAt?: string;
};

// Props for DRE report
export type DREReportProps = {
   name: string;
   type: SupportedPdfReportType;
   startDate: string;
   endDate: string;
   snapshotData: DRESnapshotData;
};

// Chart data types
export type ChartDataPoint = {
   label: string;
   value: number;
   color: string;
};

export type BarChartData = {
   labels: string[];
   datasets: Array<{
      label: string;
      data: number[];
      color: string;
   }>;
};
