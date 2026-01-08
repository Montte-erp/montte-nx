import { relations, sql } from "drizzle-orm";
import {
	boolean,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { organization, user } from "./auth";

// ============================================
// Enums
// ============================================

export const widgetTypeEnum = pgEnum("widget_type", [
	"insight",
	"text_card",
	"balance_card",
	"quick_actions",
	"bank_accounts",
	"recent_transactions",
]);

export const chartTypeEnum = pgEnum("chart_type", [
	"line",
	"area",
	"bar",
	"stacked_bar",
	"line_cumulative",
	"pie",
	"donut",
	"stat_card",
	"bar_total",
	"table",
	"world_map",
	"category_analysis",
	"comparison",
]);

export const dataSourceEnum = pgEnum("data_source", [
	"transactions",
	"bills",
	"budgets",
	"bank_accounts",
]);

export const aggregationTypeEnum = pgEnum("aggregation_type", [
	"sum",
	"count",
	"average",
	"min",
	"max",
]);

export const timeGroupingEnum = pgEnum("time_grouping", [
	"day",
	"week",
	"month",
	"quarter",
	"year",
]);

export const comparisonTypeEnum = pgEnum("comparison_type", [
	"previous_period",
	"previous_year",
]);

export const filterOperatorEnum = pgEnum("filter_operator", [
	"equals",
	"not_equals",
	"contains",
	"gt",
	"lt",
	"gte",
	"lte",
	"in",
	"not_in",
]);

export const relativePeriodEnum = pgEnum("relative_period", [
	"today",
	"yesterday",
	"last_7_days",
	"last_30_days",
	"last_90_days",
	"this_month",
	"last_month",
	"this_quarter",
	"this_year",
	"last_year",
]);

// ============================================
// Types
// ============================================

export type DashboardLayout = {
	gridColumns: number;
	gridRowHeight: number;
};

export type WidgetPosition = {
	x: number;
	y: number;
	w: number;
	h: number;
	minW?: number;
	minH?: number;
};

export type InsightFilter = {
	field: string;
	operator:
		| "equals"
		| "not_equals"
		| "contains"
		| "gt"
		| "lt"
		| "gte"
		| "lte"
		| "in"
		| "not_in";
	value: string | number | string[] | number[];
};

export type InsightBreakdown = {
	field: string;
	limit?: number;
};

export type InsightComparison = {
	type: "previous_period" | "previous_year";
};

export type InsightConfig = {
	type: "insight";
	dataSource: "transactions" | "bills" | "budgets" | "bank_accounts";
	aggregation: "sum" | "count" | "average" | "min" | "max";
	aggregateField: string;
	timeGrouping?: "day" | "week" | "month" | "quarter" | "year";
	breakdown?: InsightBreakdown;
	filters: InsightFilter[];
	chartType:
		| "line"
		| "area"
		| "bar"
		| "stacked_bar"
		| "line_cumulative"
		| "pie"
		| "donut"
		| "stat_card"
		| "bar_total"
		| "table"
		| "world_map"
		| "category_analysis"
		| "comparison";
	comparison?: InsightComparison;
	showLegend?: boolean;
	showLabels?: boolean;
	showTrendLine?: boolean;
	showAlertThresholdLines?: boolean;
	showMultipleYAxes?: boolean;
	showMovingAverage?: boolean;
	showConfidenceIntervals?: boolean;
	colorBy?: "name" | "rank";
	yAxisUnit?: string;
	yAxisScale?: "linear" | "logarithmic";
	colorScheme?: string;
	dateRangeOverride?: {
		relativePeriod?:
			| "today"
			| "yesterday"
			| "last_7_days"
			| "last_30_days"
			| "last_90_days"
			| "this_month"
			| "last_month"
			| "this_quarter"
			| "this_year"
			| "last_year";
		startDate?: string;
		endDate?: string;
	};
};

export type TextCardConfig = {
	type: "text_card";
	content: string;
};

export type BalanceCardConfig = {
	type: "balance_card";
	showComparison?: boolean;
};

export type QuickActionsConfig = {
	type: "quick_actions";
	actions: ("new_transaction" | "reports" | "payables" | "receivables")[];
};

export type BankAccountsConfig = {
	type: "bank_accounts";
	limit?: number;
	showCreateButton?: boolean;
};

export type RecentTransactionsConfig = {
	type: "recent_transactions";
	limit?: number;
};

export type WidgetConfig =
	| InsightConfig
	| TextCardConfig
	| BalanceCardConfig
	| QuickActionsConfig
	| BankAccountsConfig
	| RecentTransactionsConfig;

export type DashboardFilterConfig = {
	dateRange?: {
		startDate: string;
		endDate: string;
		relativePeriod?:
			| "today"
			| "yesterday"
			| "last_7_days"
			| "last_30_days"
			| "last_90_days"
			| "this_month"
			| "last_month"
			| "this_quarter"
			| "this_year"
			| "last_year";
	};
	bankAccountIds?: string[];
	categoryIds?: string[];
	costCenterIds?: string[];
	tagIds?: string[];
};

// ============================================
// Tables
// ============================================

export const dashboard = pgTable("dashboard", {
	id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
	name: text("name").notNull(),
	description: text("description"),
	organizationId: uuid("organization_id")
		.notNull()
		.references(() => organization.id, { onDelete: "cascade" }),
	createdBy: uuid("created_by")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	layout: jsonb("layout").$type<DashboardLayout>().default({
		gridColumns: 2,
		gridRowHeight: 100,
	}),
	tabOrder: integer("tab_order").default(0).notNull(),
	isPinned: boolean("is_pinned").default(false).notNull(),
	defaultFilters: jsonb("default_filters").$type<DashboardFilterConfig>(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
});

export const dashboardWidget = pgTable("dashboard_widget", {
	id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
	dashboardId: uuid("dashboard_id")
		.notNull()
		.references(() => dashboard.id, { onDelete: "cascade" }),
	type: widgetTypeEnum("type").notNull(),
	name: text("name").notNull(),
	description: text("description"),
	position: jsonb("position").$type<WidgetPosition>().notNull(),
	config: jsonb("config").$type<WidgetConfig>().notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
});

export const dashboardFilter = pgTable("dashboard_filter", {
	id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
	dashboardId: uuid("dashboard_id")
		.notNull()
		.references(() => dashboard.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	filterConfig: jsonb("filter_config").$type<DashboardFilterConfig>().notNull(),
	isDefault: boolean("is_default").default(false).notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const recentItemTypeEnum = pgEnum("recent_item_type", [
	"dashboard",
	"insight",
]);

export const savedInsight = pgTable("saved_insight", {
	id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
	organizationId: uuid("organization_id")
		.notNull()
		.references(() => organization.id, { onDelete: "cascade" }),
	createdBy: uuid("created_by")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	description: text("description"),
	config: jsonb("config").$type<InsightConfig>().notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
});

export const recentItem = pgTable("recent_item", {
	id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
	userId: uuid("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	organizationId: uuid("organization_id")
		.notNull()
		.references(() => organization.id, { onDelete: "cascade" }),
	itemType: recentItemTypeEnum("item_type").notNull(),
	itemId: uuid("item_id").notNull(),
	itemName: text("item_name").notNull(),
	accessedAt: timestamp("accessed_at").defaultNow().notNull(),
});

// ============================================
// Relations
// ============================================

export const dashboardRelations = relations(dashboard, ({ one, many }) => ({
	organization: one(organization, {
		fields: [dashboard.organizationId],
		references: [organization.id],
	}),
	createdByUser: one(user, {
		fields: [dashboard.createdBy],
		references: [user.id],
	}),
	widgets: many(dashboardWidget),
	filters: many(dashboardFilter),
}));

export const dashboardWidgetRelations = relations(
	dashboardWidget,
	({ one }) => ({
		dashboard: one(dashboard, {
			fields: [dashboardWidget.dashboardId],
			references: [dashboard.id],
		}),
	}),
);

export const dashboardFilterRelations = relations(
	dashboardFilter,
	({ one }) => ({
		dashboard: one(dashboard, {
			fields: [dashboardFilter.dashboardId],
			references: [dashboard.id],
		}),
	}),
);

export const savedInsightRelations = relations(savedInsight, ({ one }) => ({
	organization: one(organization, {
		fields: [savedInsight.organizationId],
		references: [organization.id],
	}),
	createdByUser: one(user, {
		fields: [savedInsight.createdBy],
		references: [user.id],
	}),
}));

export const recentItemRelations = relations(recentItem, ({ one }) => ({
	user: one(user, {
		fields: [recentItem.userId],
		references: [user.id],
	}),
	organization: one(organization, {
		fields: [recentItem.organizationId],
		references: [organization.id],
	}),
}));

// ============================================
// Type Inference
// ============================================

export type Dashboard = typeof dashboard.$inferSelect;
export type NewDashboard = typeof dashboard.$inferInsert;
export type DashboardWidget = typeof dashboardWidget.$inferSelect;
export type NewDashboardWidget = typeof dashboardWidget.$inferInsert;
export type DashboardFilter = typeof dashboardFilter.$inferSelect;
export type NewDashboardFilter = typeof dashboardFilter.$inferInsert;
export type SavedInsight = typeof savedInsight.$inferSelect;
export type NewSavedInsight = typeof savedInsight.$inferInsert;
export type RecentItem = typeof recentItem.$inferSelect;
export type NewRecentItem = typeof recentItem.$inferInsert;
