import { relations, sql } from "drizzle-orm";
import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organization, user } from "./auth";

export type FilterMetadata = {
   bankAccounts: Array<{ id: string; name: string }>;
   categories: Array<{ id: string; name: string }>;
   costCenters: Array<{ id: string; name: string }>;
   tags: Array<{ id: string; name: string }>;
};

export type DRESnapshotData = {
   summary: {
      totalIncome: number;
      totalExpenses: number;
      netResult: number;
      transactionCount: number;
   };
   categoryBreakdown: Array<{
      categoryId: string;
      categoryName: string;
      categoryColor: string;
      income: number;
      expenses: number;
   }>;
   dreLines: DRELineItem[];
   transactions: TransactionSnapshot[];
   generatedAt: string;
   filterMetadata?: FilterMetadata;
};

export type DRELineItem = {
   code: string;
   label: string;
   value: number;
   plannedValue?: number;
   variance?: number;
   isTotal: boolean;
   indent: number;
};

export type TransactionSnapshot = {
   id: string;
   date: string;
   description: string;
   amount: string;
   type: "income" | "expense" | "transfer";
   bankAccount: {
      id: string;
      name: string | null;
      bank: string;
   } | null;
   costCenter: {
      id: string;
      name: string;
      code: string | null;
   } | null;
   transactionCategories: Array<{
      category: {
         id: string;
         name: string;
         color: string;
         icon: string | null;
      };
   }>;
   transactionTags: Array<{
      tag: {
         id: string;
         name: string;
         color: string;
      };
   }>;
   categorySplits: Array<{
      categoryId: string;
      value: number;
      splitType: "amount";
   }> | null;
};

export type ReportFilterConfig = {
   bankAccountIds?: string[];
   categoryIds?: string[];
   costCenterIds?: string[];
   tagIds?: string[];
   includeTransfers?: boolean;
};

// Report type definitions
export type ReportType =
   | "dre_gerencial"
   | "dre_fiscal"
   | "budget_vs_actual"
   | "spending_trends"
   | "cash_flow_forecast"
   | "counterparty_analysis"
   | "category_analysis";

// Budget vs Actual snapshot data
export type BudgetVsActualSnapshotData = {
   type: "budget_vs_actual";
   summary: {
      totalBudgeted: number;
      totalActual: number;
      variance: number;
      variancePercent: number;
   };
   categoryComparisons: Array<{
      categoryId: string;
      categoryName: string;
      categoryColor: string;
      budgeted: number;
      actual: number;
      variance: number;
      variancePercent: number;
   }>;
   monthlyBreakdown: Array<{
      month: string;
      year: number;
      budgeted: number;
      actual: number;
      variance: number;
   }>;
   generatedAt: string;
   filterMetadata?: FilterMetadata;
};

// Spending Trends snapshot data
export type SpendingTrendsSnapshotData = {
   type: "spending_trends";
   summary: {
      avgMonthlySpending: number;
      avgMonthlyIncome: number;
      highestExpenseMonth: { month: string; year: number; amount: number };
      lowestExpenseMonth: { month: string; year: number; amount: number };
      trend: "increasing" | "decreasing" | "stable";
      trendPercent: number;
   };
   monthlyData: Array<{
      month: string;
      year: number;
      income: number;
      expenses: number;
      net: number;
   }>;
   categoryTrends: Array<{
      categoryId: string;
      categoryName: string;
      categoryColor: string;
      totalAmount: number;
      monthlyAmounts: Array<{ month: string; year: number; amount: number }>;
   }>;
   yoyComparison?: {
      currentYearTotal: number;
      previousYearTotal: number;
      change: number;
      changePercent: number;
   };
   generatedAt: string;
   filterMetadata?: FilterMetadata;
};

// Cash Flow Forecast snapshot data
export type CashFlowForecastSnapshotData = {
   type: "cash_flow_forecast";
   summary: {
      currentBalance: number;
      projectedBalance: number;
      projectionDays: number;
      totalProjectedIncome: number;
      totalProjectedExpenses: number;
   };
   dailyProjections: Array<{
      date: string;
      projectedIncome: number;
      projectedExpenses: number;
      balance: number;
   }>;
   upcomingBills: Array<{
      billId: string;
      description: string;
      amount: number;
      dueDate: string;
      type: "income" | "expense";
      counterpartyName?: string;
   }>;
   recurringPatterns: Array<{
      description: string;
      amount: number;
      frequency: string;
      type: "income" | "expense";
   }>;
   generatedAt: string;
   filterMetadata?: FilterMetadata;
};

// Counterparty Analysis snapshot data
export type CounterpartyAnalysisSnapshotData = {
   type: "counterparty_analysis";
   summary: {
      totalCounterparties: number;
      totalCustomers: number;
      totalSuppliers: number;
      totalReceived: number;
      totalPaid: number;
      netBalance: number;
   };
   topCustomer?: {
      id: string;
      name: string;
      totalAmount: number;
      transactionCount: number;
   };
   topSupplier?: {
      id: string;
      name: string;
      totalAmount: number;
      transactionCount: number;
   };
   customers: Array<{
      counterpartyId: string;
      counterpartyName: string;
      totalAmount: number;
      transactionCount: number;
      lastTransactionDate: string;
      percentOfTotal: number;
   }>;
   suppliers: Array<{
      counterpartyId: string;
      counterpartyName: string;
      totalAmount: number;
      transactionCount: number;
      lastTransactionDate: string;
      percentOfTotal: number;
   }>;
   generatedAt: string;
   filterMetadata?: FilterMetadata;
};

// Category Analysis snapshot data
export type CategoryAnalysisSnapshotData = {
   type: "category_analysis";
   summary: {
      totalIncome: number;
      totalExpenses: number;
      totalTransactions: number;
      incomeCategories: number;
      expenseCategories: number;
   };
   incomeBreakdown: Array<{
      categoryId: string;
      categoryName: string;
      categoryColor: string;
      categoryIcon: string | null;
      amount: number;
      percentage: number;
      transactionCount: number;
   }>;
   expenseBreakdown: Array<{
      categoryId: string;
      categoryName: string;
      categoryColor: string;
      categoryIcon: string | null;
      amount: number;
      percentage: number;
      transactionCount: number;
   }>;
   generatedAt: string;
   filterMetadata?: FilterMetadata;
};

// Union type for all snapshot data with discriminator
export type ReportSnapshotData =
   | (DRESnapshotData & { type?: "dre_gerencial" | "dre_fiscal" })
   | BudgetVsActualSnapshotData
   | SpendingTrendsSnapshotData
   | CashFlowForecastSnapshotData
   | CounterpartyAnalysisSnapshotData
   | CategoryAnalysisSnapshotData;

export const customReport = pgTable("custom_report", {
   createdAt: timestamp("created_at").defaultNow().notNull(),
   createdBy: uuid("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
   description: text("description"),
   endDate: timestamp("end_date").notNull(),
   filterConfig: jsonb("filter_config").$type<ReportFilterConfig>(),
   id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
   name: text("name").notNull(),
   organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
   snapshotData: jsonb("snapshot_data").$type<ReportSnapshotData>().notNull(),
   startDate: timestamp("start_date").notNull(),
   type: text("type").$type<ReportType>().notNull(),
   updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
});

export const customReportRelations = relations(customReport, ({ one }) => ({
   createdByUser: one(user, {
      fields: [customReport.createdBy],
      references: [user.id],
   }),
   organization: one(organization, {
      fields: [customReport.organizationId],
      references: [organization.id],
   }),
}));

export type CustomReport = typeof customReport.$inferSelect;
export type NewCustomReport = typeof customReport.$inferInsert;
