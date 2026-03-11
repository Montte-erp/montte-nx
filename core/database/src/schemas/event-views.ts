import { sql } from "drizzle-orm";
import {
   bigint,
   date,
   decimal,
   integer,
   pgMaterializedView,
   text,
   uuid,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// daily_usage_by_event
// ---------------------------------------------------------------------------

export const dailyUsageByEvent = pgMaterializedView("daily_usage_by_event", {
   organizationId: uuid("organization_id").notNull(),
   eventName: text("event_name").notNull(),
   eventCategory: text("event_category").notNull(),
   date: date("date").notNull(),
   eventCount: integer("event_count").notNull(),
   totalCost: decimal("total_cost", { precision: 10, scale: 6 }).notNull(),
}).as(sql`
	SELECT
		organization_id,
		event_name,
		event_category,
		DATE(timestamp) AS date,
		COUNT(*)::int AS event_count,
		COALESCE(SUM(price_per_event::numeric), 0) AS total_cost
	FROM events
	WHERE is_billable = true
	GROUP BY organization_id, event_name, event_category, DATE(timestamp)
`);

// ---------------------------------------------------------------------------
// current_month_usage_by_event
// ---------------------------------------------------------------------------

export const currentMonthUsageByEvent = pgMaterializedView(
   "current_month_usage_by_event",
   {
      organizationId: uuid("organization_id").notNull(),
      eventName: text("event_name").notNull(),
      eventCategory: text("event_category").notNull(),
      eventCount: integer("event_count").notNull(),
      monthToDateCost: decimal("month_to_date_cost", {
         precision: 10,
         scale: 6,
      }).notNull(),
   },
).as(sql`
	SELECT
		organization_id,
		event_name,
		event_category,
		COUNT(*)::int AS event_count,
		COALESCE(SUM(price_per_event::numeric), 0) AS month_to_date_cost
	FROM events
	WHERE timestamp >= DATE_TRUNC('month', CURRENT_DATE)
		AND is_billable = true
	GROUP BY organization_id, event_name, event_category
`);

// ---------------------------------------------------------------------------
// current_month_usage_by_category
// ---------------------------------------------------------------------------

export const currentMonthUsageByCategory = pgMaterializedView(
   "current_month_usage_by_category",
   {
      organizationId: uuid("organization_id").notNull(),
      eventCategory: text("event_category").notNull(),
      eventCount: integer("event_count").notNull(),
      monthToDateCost: decimal("month_to_date_cost", {
         precision: 10,
         scale: 6,
      }).notNull(),
      projectedCost: decimal("projected_cost", {
         precision: 10,
         scale: 6,
      }).notNull(),
   },
).as(sql`
	SELECT
		organization_id,
		event_category,
		COUNT(*)::int AS event_count,
		COALESCE(SUM(price_per_event::numeric), 0) AS month_to_date_cost,
		CASE
			WHEN EXTRACT(DAY FROM CURRENT_DATE) > 0 THEN
				(COALESCE(SUM(price_per_event::numeric), 0) / EXTRACT(DAY FROM CURRENT_DATE)) *
				EXTRACT(DAY FROM DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')
			ELSE 0
		END AS projected_cost
	FROM events
	WHERE timestamp >= DATE_TRUNC('month', CURRENT_DATE)
		AND is_billable = true
	GROUP BY organization_id, event_category
`);

// ---------------------------------------------------------------------------
// monthly_ai_usage
// ---------------------------------------------------------------------------

export const monthlyAiUsage = pgMaterializedView("monthly_ai_usage", {
   organizationId: uuid("organization_id").notNull(),
   month: date("month").notNull(),
   completions: integer("completions").notNull(),
   chatMessages: integer("chat_messages").notNull(),
   agentActions: integer("agent_actions").notNull(),
   totalTokens: integer("total_tokens"),
   promptTokens: integer("prompt_tokens"),
   completionTokens: integer("completion_tokens"),
   avgLatencyMs: decimal("avg_latency_ms", { precision: 10, scale: 2 }),
}).as(sql`
	SELECT
		organization_id,
		DATE_TRUNC('month', timestamp)::date AS month,
		COUNT(*) FILTER (WHERE event_name = 'ai.completion')::int AS completions,
		COUNT(*) FILTER (WHERE event_name = 'ai.chat_message')::int AS chat_messages,
		COUNT(*) FILTER (WHERE event_name = 'ai.agent_action')::int AS agent_actions,
		SUM((properties->>'totalTokens')::int) AS total_tokens,
		SUM((properties->>'promptTokens')::int) AS prompt_tokens,
		SUM((properties->>'completionTokens')::int) AS completion_tokens,
		AVG((properties->>'latencyMs')::numeric) AS avg_latency_ms
	FROM events
	WHERE event_category = 'ai'
	GROUP BY organization_id, DATE_TRUNC('month', timestamp)
`);

// ---------------------------------------------------------------------------
// daily_event_counts
// ---------------------------------------------------------------------------

export const dailyEventCounts = pgMaterializedView("daily_event_counts", {
   organizationId: uuid("organization_id").notNull(),
   eventName: text("event_name").notNull(),
   eventCategory: text("event_category").notNull(),
   date: date("date").notNull(),
   eventCount: integer("event_count").notNull(),
   uniqueUsers: integer("unique_users").notNull(),
}).as(sql`
	SELECT
		organization_id,
		event_name,
		event_category,
		DATE(timestamp) AS date,
		COUNT(*)::int AS event_count,
		COUNT(DISTINCT user_id)::int AS unique_users
	FROM events
	WHERE timestamp >= CURRENT_DATE - INTERVAL '90 days'
	GROUP BY organization_id, event_name, event_category, DATE(timestamp)
`);

// ---------------------------------------------------------------------------
// current_month_storage_cost
// ---------------------------------------------------------------------------

export const currentMonthStorageCost = pgMaterializedView(
   "current_month_storage_cost",
   {
      organizationId: uuid("organization_id").notNull(),
      currentBytes: bigint("current_bytes", { mode: "bigint" }).notNull(),
      monthToDateCost: decimal("month_to_date_cost", {
         precision: 10,
         scale: 6,
      }).notNull(),
      projectedCost: decimal("projected_cost", {
         precision: 10,
         scale: 6,
      }).notNull(),
   },
).as(sql`
   SELECT
      organization_id,
      COALESCE(SUM(size), 0)::bigint AS current_bytes,
      COALESCE(SUM(
         (size / 1073741824.0) *
         GREATEST(
            EXTRACT(EPOCH FROM (
               NOW() - GREATEST(created_at, DATE_TRUNC('month', CURRENT_DATE))
            )) / 86400.0, 0
         ) /
         EXTRACT(DAY FROM (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day'))
         * 1.50
      ), 0) AS month_to_date_cost,
      COALESCE(SUM(size / 1073741824.0) * 1.50, 0) AS projected_cost
   FROM assets
   GROUP BY organization_id
`);
