import {
   acknowledgeAnomaly,
   countUnacknowledgedAnomalies,
   findAnomaliesByOrganizationId,
   findAnomalyById,
} from "@packages/database/repositories/anomaly-repository";
import {
   addWidget,
   createDashboard,
   createDashboardFilter,
   createSavedInsight,
   deleteDashboard,
   deleteDashboardFilter,
   deleteSavedInsight,
   duplicateDashboard,
   ensureDefaultDashboard,
   findDashboardById,
   findDashboardsByOrganizationId,
   findSavedInsightById,
   findSavedInsightsByOrganizationId,
   getRecentItems,
   type InsightConfig,
   recordRecentAccess,
   removeWidget,
   reorderDashboardTabs,
   setDashboardAsDefault,
   setDefaultDashboardFilter,
   updateDashboard,
   updateSavedInsight,
   updateWidget,
   updateWidgetPositions,
} from "@packages/database/repositories/dashboard-repository";
import {
   bankAccount,
   bill,
   category,
   transaction,
   transactionCategory,
} from "@packages/database/schema";
import type {
   DashboardFilterConfig,
   DashboardLayout,
   WidgetConfig,
   WidgetPosition,
} from "@packages/database/schemas/dashboards";
// budget table is accessed via db.query.budget in queryBudgetInsight
import { decryptTransactionFields } from "@packages/encryption/service";
import { APIError } from "@packages/utils/errors";
import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc";

// ============================================
// Validation Schemas
// ============================================

const widgetPositionSchema = z.object({
   x: z.number().min(0).max(5),
   y: z.number().min(0),
   w: z.number().min(1).max(6),
   h: z.number().min(1),
   minW: z.number().optional(),
   minH: z.number().optional(),
});

const insightFilterSchema = z.object({
   field: z.string(),
   operator: z.enum([
      "equals",
      "not_equals",
      "contains",
      "gt",
      "lt",
      "gte",
      "lte",
      "in",
      "not_in",
   ]),
   value: z.union([
      z.string(),
      z.number(),
      z.array(z.string()),
      z.array(z.number()),
   ]),
});

const insightConfigSchema = z.object({
   type: z.literal("insight"),
   dataSource: z.enum(["transactions", "bills", "budgets", "bank_accounts"]),
   aggregation: z.enum(["sum", "count", "average", "min", "max"]),
   aggregateField: z.string(),
   timeGrouping: z.enum(["day", "week", "month", "quarter", "year"]).optional(),
   breakdown: z
      .object({
         field: z.string(),
         limit: z.number().optional(),
      })
      .optional(),
   filters: z.array(insightFilterSchema),
   chartType: z.enum([
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
      "sankey",
      "heatmap",
   ]),
   comparison: z
      .object({
         type: z.enum(["previous_period", "previous_year"]),
      })
      .optional(),
   comparisonOverlay: z
      .object({
         enabled: z.boolean(),
         type: z.enum(["previous_period", "previous_year"]),
         style: z.enum(["dashed", "dotted", "solid"]),
      })
      .optional(),
   forecast: z
      .object({
         enabled: z.boolean(),
         model: z.enum(["linear", "moving_average", "exponential_smoothing"]),
         periods: z.number(),
         showConfidenceInterval: z.boolean().optional(),
      })
      .optional(),
   showLegend: z.boolean().optional(),
   showLabels: z.boolean().optional(),
   showTrendLine: z.boolean().optional(),
   showAlertThresholdLines: z.boolean().optional(),
   showMultipleYAxes: z.boolean().optional(),
   showMovingAverage: z.boolean().optional(),
   showConfidenceIntervals: z.boolean().optional(),
   colorBy: z.enum(["name", "rank"]).optional(),
   yAxisUnit: z.string().optional(),
   yAxisScale: z.enum(["linear", "logarithmic"]).optional(),
   colorScheme: z.string().optional(),
   dateRangeOverride: z
      .object({
         relativePeriod: z
            .enum([
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
               "custom",
            ])
            .optional(),
         startDate: z.string().optional(),
         endDate: z.string().optional(),
      })
      .optional(),
   miniChart: z
      .object({
         type: z.enum(["sparkline", "area", "bar"]),
         showTrend: z.boolean(),
      })
      .optional(),
});

const textCardConfigSchema = z.object({
   type: z.literal("text_card"),
   content: z.string(),
});

const anomalyCardConfigSchema = z.object({
   type: z.literal("anomaly_card"),
   limit: z.number().optional(),
   showAcknowledged: z.boolean().optional(),
});

const widgetConfigSchema = z.discriminatedUnion("type", [
   insightConfigSchema,
   textCardConfigSchema,
   anomalyCardConfigSchema,
]);

const dashboardLayoutSchema = z.object({
   gridColumns: z.number().default(2),
   gridRowHeight: z.number().default(100),
});

const dashboardFilterConfigSchema = z.object({
   dateRange: z
      .object({
         startDate: z.string(),
         endDate: z.string(),
         relativePeriod: z
            .enum([
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
            ])
            .optional(),
      })
      .optional(),
   bankAccountIds: z.array(z.string().uuid()).optional(),
   categoryIds: z.array(z.string().uuid()).optional(),
   costCenterIds: z.array(z.string().uuid()).optional(),
   tagIds: z.array(z.string().uuid()).optional(),
});

// ============================================
// Router
// ============================================

export const dashboardRouter = router({
   // Dashboard CRUD
   create: protectedProcedure
      .input(
         z.object({
            name: z.string().min(1).max(100),
            description: z.string().max(500).optional(),
            layout: dashboardLayoutSchema.optional(),
            defaultFilters: dashboardFilterConfigSchema.optional(),
         }),
      )
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;
         const userId = resolvedCtx.session?.user.id;

         if (!userId) {
            throw APIError.unauthorized("User ID is required");
         }

         return createDashboard(resolvedCtx.db, {
            createdBy: userId,
            defaultFilters: input.defaultFilters as DashboardFilterConfig,
            description: input.description,
            layout: input.layout as DashboardLayout,
            name: input.name,
            organizationId,
         });
      }),

   update: protectedProcedure
      .input(
         z.object({
            id: z.string().uuid(),
            name: z.string().min(1).max(100).optional(),
            description: z.string().max(500).optional().nullable(),
            layout: dashboardLayoutSchema.optional(),
            isPinned: z.boolean().optional(),
            defaultFilters: dashboardFilterConfigSchema.optional().nullable(),
         }),
      )
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const existing = await findDashboardById(resolvedCtx.db, input.id);
         if (!existing || existing.organizationId !== organizationId) {
            throw APIError.notFound("Dashboard not found");
         }

         return updateDashboard(resolvedCtx.db, input.id, {
            defaultFilters: input.defaultFilters as
               | DashboardFilterConfig
               | undefined,
            description: input.description ?? undefined,
            isPinned: input.isPinned,
            layout: input.layout as DashboardLayout | undefined,
            name: input.name,
         });
      }),

   delete: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const existing = await findDashboardById(resolvedCtx.db, input.id);
         if (!existing || existing.organizationId !== organizationId) {
            throw APIError.notFound("Dashboard not found");
         }

         return deleteDashboard(resolvedCtx.db, input.id);
      }),

   getById: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const dashboard = await findDashboardById(resolvedCtx.db, input.id);
         if (!dashboard || dashboard.organizationId !== organizationId) {
            throw APIError.notFound("Dashboard not found");
         }

         return dashboard;
      }),

   getAll: protectedProcedure
      .input(
         z
            .object({
               search: z.string().optional(),
               pinnedOnly: z.boolean().optional(),
            })
            .optional(),
      )
      .query(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         return findDashboardsByOrganizationId(resolvedCtx.db, organizationId, {
            pinnedOnly: input?.pinnedOnly,
            search: input?.search,
         });
      }),

   reorderTabs: protectedProcedure
      .input(
         z.object({
            orderedIds: z.array(z.string().uuid()),
         }),
      )
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         await reorderDashboardTabs(
            resolvedCtx.db,
            organizationId,
            input.orderedIds,
         );

         return { success: true };
      }),

   duplicate: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;
         const userId = resolvedCtx.session?.user.id;

         if (!userId) {
            throw APIError.unauthorized("User ID is required");
         }

         const existing = await findDashboardById(resolvedCtx.db, input.id);
         if (!existing || existing.organizationId !== organizationId) {
            throw APIError.notFound("Dashboard not found");
         }

         return duplicateDashboard(resolvedCtx.db, input.id, userId);
      }),

   // Default Dashboard
   getDefault: protectedProcedure.query(async ({ ctx }) => {
      const resolvedCtx = await ctx;
      const organizationId = resolvedCtx.organizationId;
      const userId = resolvedCtx.session?.user.id;

      if (!userId) {
         throw APIError.unauthorized("User ID is required");
      }

      const dashboard = await ensureDefaultDashboard(
         resolvedCtx.db,
         organizationId,
         userId,
      );

      return findDashboardById(resolvedCtx.db, dashboard.id);
   }),

   setAsDefault: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const existing = await findDashboardById(resolvedCtx.db, input.id);
         if (!existing || existing.organizationId !== organizationId) {
            throw APIError.notFound("Dashboard not found");
         }

         return setDashboardAsDefault(resolvedCtx.db, input.id, organizationId);
      }),

   // Widget CRUD
   addWidget: protectedProcedure
      .input(
         z.object({
            dashboardId: z.string().uuid(),
            name: z.string().min(1).max(100),
            description: z.string().max(500).nullish(),
            type: z.enum([
               "insight",
               "text_card",
               "anomaly_card",
            ]),
            position: widgetPositionSchema,
            config: widgetConfigSchema,
         }),
      )
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const dashboard = await findDashboardById(
            resolvedCtx.db,
            input.dashboardId,
         );
         if (!dashboard || dashboard.organizationId !== organizationId) {
            throw APIError.notFound("Dashboard not found");
         }

         return addWidget(resolvedCtx.db, {
            config: input.config as WidgetConfig,
            dashboardId: input.dashboardId,
            name: input.name,
            description: input.description ?? null,
            position: input.position as WidgetPosition,
            type: input.type,
         });
      }),

   updateWidget: protectedProcedure
      .input(
         z.object({
            widgetId: z.string().uuid(),
            name: z.string().min(1).max(100).optional(),
            description: z.string().max(500).nullish(),
            position: widgetPositionSchema.optional(),
            config: widgetConfigSchema.optional(),
         }),
      )
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;

         return updateWidget(resolvedCtx.db, input.widgetId, {
            config: input.config as WidgetConfig | undefined,
            name: input.name,
            description: input.description,
            position: input.position as WidgetPosition | undefined,
         });
      }),

   removeWidget: protectedProcedure
      .input(z.object({ widgetId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         return removeWidget(resolvedCtx.db, input.widgetId);
      }),

   updateWidgetPositions: protectedProcedure
      .input(
         z.object({
            positions: z.array(
               z.object({
                  widgetId: z.string().uuid(),
                  position: widgetPositionSchema,
               }),
            ),
         }),
      )
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;

         await updateWidgetPositions(
            resolvedCtx.db,
            input.positions.map((p) => ({
               position: p.position as WidgetPosition,
               widgetId: p.widgetId,
            })),
         );

         return { success: true };
      }),

   // Dashboard Filters
   createFilter: protectedProcedure
      .input(
         z.object({
            dashboardId: z.string().uuid(),
            name: z.string().min(1).max(50),
            filterConfig: dashboardFilterConfigSchema,
            isDefault: z.boolean().optional(),
         }),
      )
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const dashboard = await findDashboardById(
            resolvedCtx.db,
            input.dashboardId,
         );
         if (!dashboard || dashboard.organizationId !== organizationId) {
            throw APIError.notFound("Dashboard not found");
         }

         return createDashboardFilter(resolvedCtx.db, {
            dashboardId: input.dashboardId,
            filterConfig: input.filterConfig as DashboardFilterConfig,
            isDefault: input.isDefault,
            name: input.name,
         });
      }),

   deleteFilter: protectedProcedure
      .input(z.object({ filterId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         return deleteDashboardFilter(resolvedCtx.db, input.filterId);
      }),

   setDefaultFilter: protectedProcedure
      .input(
         z.object({
            dashboardId: z.string().uuid(),
            filterId: z.string().uuid(),
         }),
      )
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         await setDefaultDashboardFilter(
            resolvedCtx.db,
            input.dashboardId,
            input.filterId,
         );
         return { success: true };
      }),

   // Real-time insight data query
   queryInsight: protectedProcedure
      .input(
         z.object({
            config: insightConfigSchema,
            globalFilters: dashboardFilterConfigSchema.optional(),
         }),
      )
      .query(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;
         const { config, globalFilters } = input;

         // Parse date range from global filters or default to last 30 days
         let startDate: Date;
         let endDate: Date;

         if (globalFilters?.dateRange) {
            startDate = new Date(globalFilters.dateRange.startDate);
            endDate = new Date(globalFilters.dateRange.endDate);
         } else {
            endDate = new Date();
            startDate = new Date();
            startDate.setDate(startDate.getDate() - 30);
         }

         // Route to appropriate query based on data source
         switch (config.dataSource) {
            case "transactions":
               return queryTransactionInsight(
                  resolvedCtx.db,
                  organizationId,
                  config,
                  startDate,
                  endDate,
                  globalFilters,
               );
            case "bills":
               return queryBillInsight(
                  resolvedCtx.db,
                  organizationId,
                  config,
                  startDate,
                  endDate,
                  globalFilters,
               );
            case "budgets":
               return queryBudgetInsight(
                  resolvedCtx.db,
                  organizationId,
                  config,
                  startDate,
                  endDate,
               );
            case "bank_accounts":
               return queryBankAccountInsight(
                  resolvedCtx.db,
                  organizationId,
                  config,
                  globalFilters,
               );
            default:
               throw APIError.validation("Invalid data source");
         }
      }),

   // ============================================
   // Saved Insights
   // ============================================

   createSavedInsight: protectedProcedure
      .input(
         z.object({
            name: z.string().min(1).max(100),
            description: z.string().max(500).optional(),
            config: insightConfigSchema,
         }),
      )
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;
         const userId = resolvedCtx.userId;

         return createSavedInsight(resolvedCtx.db, {
            config: input.config,
            createdBy: userId,
            description: input.description,
            name: input.name,
            organizationId,
         });
      }),

   updateSavedInsight: protectedProcedure
      .input(
         z.object({
            id: z.string().uuid(),
            name: z.string().min(1).max(100).optional(),
            description: z.string().max(500).optional(),
            config: insightConfigSchema.optional(),
         }),
      )
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const { id, ...data } = input;

         const insight = await findSavedInsightById(resolvedCtx.db, id);
         if (
            !insight ||
            insight.organizationId !== resolvedCtx.organizationId
         ) {
            throw APIError.notFound("Saved insight not found");
         }

         return updateSavedInsight(resolvedCtx.db, id, data);
      }),

   deleteSavedInsight: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;

         const insight = await findSavedInsightById(resolvedCtx.db, input.id);
         if (
            !insight ||
            insight.organizationId !== resolvedCtx.organizationId
         ) {
            throw APIError.notFound("Saved insight not found");
         }

         return deleteSavedInsight(resolvedCtx.db, input.id);
      }),

   getSavedInsight: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;

         const insight = await findSavedInsightById(resolvedCtx.db, input.id);
         if (
            !insight ||
            insight.organizationId !== resolvedCtx.organizationId
         ) {
            throw APIError.notFound("Saved insight not found");
         }

         return insight;
      }),

   getAllSavedInsights: protectedProcedure
      .input(z.object({ search: z.string().optional() }).optional())
      .query(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         return findSavedInsightsByOrganizationId(
            resolvedCtx.db,
            organizationId,
            {
               search: input?.search,
            },
         );
      }),

   // ============================================
   // Recent Items
   // ============================================

   recordAccess: protectedProcedure
      .input(
         z.object({
            itemType: z.enum(["dashboard", "insight"]),
            itemId: z.string().uuid(),
            itemName: z.string(),
         }),
      )
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;
         const userId = resolvedCtx.userId;

         return recordRecentAccess(resolvedCtx.db, {
            itemId: input.itemId,
            itemName: input.itemName,
            itemType: input.itemType,
            organizationId,
            userId,
         });
      }),

   getRecents: protectedProcedure
      .input(
         z.object({ limit: z.number().min(1).max(50).default(10) }).optional(),
      )
      .query(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;
         const userId = resolvedCtx.userId;

         return getRecentItems(
            resolvedCtx.db,
            userId,
            organizationId,
            input?.limit ?? 10,
         );
      }),

   // ============================================
   // Anomaly Detection
   // ============================================

   getAnomalies: protectedProcedure
      .input(
         z
            .object({
               includeAcknowledged: z.boolean().optional(),
               limit: z.number().min(1).max(100).optional(),
               offset: z.number().min(0).optional(),
            })
            .optional(),
      )
      .query(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         return findAnomaliesByOrganizationId(resolvedCtx.db, organizationId, {
            includeAcknowledged: input?.includeAcknowledged,
            limit: input?.limit,
            offset: input?.offset,
         });
      }),

   getAnomalyById: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const anomaly = await findAnomalyById(resolvedCtx.db, input.id);
         if (!anomaly || anomaly.organizationId !== organizationId) {
            throw APIError.notFound("Anomaly not found");
         }

         return anomaly;
      }),

   acknowledgeAnomaly: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;
         const userId = resolvedCtx.userId;

         const anomaly = await findAnomalyById(resolvedCtx.db, input.id);
         if (!anomaly || anomaly.organizationId !== organizationId) {
            throw APIError.notFound("Anomaly not found");
         }

         return acknowledgeAnomaly(resolvedCtx.db, input.id, userId);
      }),

   getAnomalyCount: protectedProcedure.query(async ({ ctx }) => {
      const resolvedCtx = await ctx;
      const organizationId = resolvedCtx.organizationId;

      return countUnacknowledgedAnomalies(resolvedCtx.db, organizationId);
   }),
});

// ============================================
// Insight Query Helpers
// ============================================

type InsightResult = {
   value: number;
   comparison?: {
      previousValue: number;
      change: number;
      changePercent: number;
   };
   breakdown?: Array<{
      label: string;
      value: number;
      color?: string;
   }>;
   timeSeries?: Array<{
      date: string;
      value: number;
   }>;
   comparisonTimeSeries?: Array<{
      date: string;
      value: number;
   }>;
   tableData?: Array<Record<string, unknown>>;
};

async function queryTransactionInsight(
   db: any,
   organizationId: string,
   config: InsightConfig,
   startDate: Date,
   endDate: Date,
   globalFilters?: DashboardFilterConfig,
): Promise<InsightResult> {
   const baseConditions = [
      eq(transaction.organizationId, organizationId),
      gte(transaction.date, startDate),
      lte(transaction.date, endDate),
   ];

   // Apply filters from config
   for (const filter of config.filters) {
      if (filter.field === "type" && filter.operator === "equals") {
         baseConditions.push(eq(transaction.type, filter.value as string));
      }
   }

   // Apply global filters
   if (globalFilters?.bankAccountIds?.length) {
      baseConditions.push(
         inArray(transaction.bankAccountId, globalFilters.bankAccountIds),
      );
   }

   const whereClause = and(...baseConditions);

   // Build aggregation SQL
   let aggregateSql: ReturnType<typeof sql<number>>;
   switch (config.aggregation) {
      case "sum":
         aggregateSql = sql<number>`COALESCE(SUM(CAST(${transaction.amount} AS REAL)), 0)`;
         break;
      case "count":
         aggregateSql = sql<number>`COUNT(*)`;
         break;
      case "average":
         aggregateSql = sql<number>`COALESCE(AVG(CAST(${transaction.amount} AS REAL)), 0)`;
         break;
      case "min":
         aggregateSql = sql<number>`COALESCE(MIN(CAST(${transaction.amount} AS REAL)), 0)`;
         break;
      case "max":
         aggregateSql = sql<number>`COALESCE(MAX(CAST(${transaction.amount} AS REAL)), 0)`;
         break;
      default:
         aggregateSql = sql<number>`COALESCE(SUM(CAST(${transaction.amount} AS REAL)), 0)`;
   }

   // Get main value
   const mainResult = await db
      .select({ value: aggregateSql })
      .from(transaction)
      .where(whereClause);

   const result: InsightResult = {
      value: mainResult[0]?.value || 0,
   };

   // Handle comparison
   if (config.comparison) {
      const periodMs = endDate.getTime() - startDate.getTime();
      let prevStartDate: Date;
      let prevEndDate: Date;

      if (config.comparison.type === "previous_period") {
         prevEndDate = new Date(startDate.getTime() - 1);
         prevStartDate = new Date(prevEndDate.getTime() - periodMs);
      } else {
         // previous_year
         prevStartDate = new Date(startDate);
         prevStartDate.setFullYear(prevStartDate.getFullYear() - 1);
         prevEndDate = new Date(endDate);
         prevEndDate.setFullYear(prevEndDate.getFullYear() - 1);
      }

      const prevConditions = [
         eq(transaction.organizationId, organizationId),
         gte(transaction.date, prevStartDate),
         lte(transaction.date, prevEndDate),
      ];

      if (globalFilters?.bankAccountIds?.length) {
         prevConditions.push(
            inArray(transaction.bankAccountId, globalFilters.bankAccountIds),
         );
      }

      const prevResult = await db
         .select({ value: aggregateSql })
         .from(transaction)
         .where(and(...prevConditions));

      const previousValue = prevResult[0]?.value || 0;
      const change = result.value - previousValue;
      const changePercent =
         previousValue !== 0 ? (change / previousValue) * 100 : 0;

      result.comparison = {
         change,
         changePercent,
         previousValue,
      };
   }

   // Handle breakdown (generate regardless of chart type for flexibility)
   if (config.breakdown) {
      if (config.breakdown.field === "categoryId") {
         const breakdownResult = await db
            .select({
               color: category.color,
               label: category.name,
               value: aggregateSql,
            })
            .from(transaction)
            .innerJoin(
               transactionCategory,
               eq(transaction.id, transactionCategory.transactionId),
            )
            .innerJoin(
               category,
               eq(transactionCategory.categoryId, category.id),
            )
            .where(whereClause)
            .groupBy(category.id, category.name, category.color)
            .orderBy(desc(aggregateSql))
            .limit(config.breakdown.limit || 10);

         result.breakdown = breakdownResult.map(
            (row: { label: string; value: number; color: string | null }) => ({
               color: row.color || "#8884d8",
               label: row.label,
               value: row.value,
            }),
         );
      } else if (config.breakdown.field === "bankAccountId") {
         const breakdownResult = await db
            .select({
               label: bankAccount.name,
               value: aggregateSql,
            })
            .from(transaction)
            .innerJoin(
               bankAccount,
               eq(transaction.bankAccountId, bankAccount.id),
            )
            .where(whereClause)
            .groupBy(bankAccount.id, bankAccount.name)
            .orderBy(desc(aggregateSql))
            .limit(config.breakdown.limit || 10);

         result.breakdown = breakdownResult.map(
            (row: { label: string | null; value: number }) => ({
               label: row.label || "Unknown",
               value: row.value,
            }),
         );
      } else if (config.breakdown.field === "type") {
         const breakdownResult = await db
            .select({
               label: transaction.type,
               value: aggregateSql,
            })
            .from(transaction)
            .where(whereClause)
            .groupBy(transaction.type)
            .orderBy(desc(aggregateSql));

         result.breakdown = breakdownResult.map(
            (row: { label: string; value: number }) => ({
               color:
                  row.label === "income"
                     ? "#10b981"
                     : row.label === "expense"
                       ? "#ef4444"
                       : "#8884d8",
               label: row.label,
               value: row.value,
            }),
         );
      }
   }

   // Handle time series grouping
   if (config.timeGrouping) {
      let dateFormat: string;
      switch (config.timeGrouping) {
         case "day":
            dateFormat = "YYYY-MM-DD";
            break;
         case "week":
            dateFormat = "IYYY-IW";
            break;
         case "month":
            dateFormat = "YYYY-MM";
            break;
         case "quarter":
            dateFormat = 'YYYY-"Q"Q';
            break;
         case "year":
            dateFormat = "YYYY";
            break;
         default:
            dateFormat = "YYYY-MM";
      }

      const timeSeriesResult = await db
         .select({
            date: sql<string>`TO_CHAR(${transaction.date}, '${sql.raw(dateFormat)}')`,
            value: aggregateSql,
         })
         .from(transaction)
         .where(whereClause)
         .groupBy(sql`TO_CHAR(${transaction.date}, '${sql.raw(dateFormat)}')`)
         .orderBy(
            asc(sql`TO_CHAR(${transaction.date}, '${sql.raw(dateFormat)}')`),
         );

      result.timeSeries = timeSeriesResult.map(
         (row: { date: string; value: number }) => ({
            date: row.date,
            value: row.value,
         }),
      );

      // Handle comparison overlay time series
      if (config.comparisonOverlay?.enabled) {
         const periodMs = endDate.getTime() - startDate.getTime();
         let prevStartDate: Date;
         let prevEndDate: Date;

         if (config.comparisonOverlay.type === "previous_period") {
            prevEndDate = new Date(startDate.getTime() - 1);
            prevStartDate = new Date(prevEndDate.getTime() - periodMs);
         } else {
            // previous_year
            prevStartDate = new Date(startDate);
            prevStartDate.setFullYear(prevStartDate.getFullYear() - 1);
            prevEndDate = new Date(endDate);
            prevEndDate.setFullYear(prevEndDate.getFullYear() - 1);
         }

         const prevConditions = [
            eq(transaction.organizationId, organizationId),
            gte(transaction.date, prevStartDate),
            lte(transaction.date, prevEndDate),
         ];

         if (globalFilters?.bankAccountIds?.length) {
            prevConditions.push(
               inArray(transaction.bankAccountId, globalFilters.bankAccountIds),
            );
         }

         const comparisonTimeSeriesResult = await db
            .select({
               date: sql<string>`TO_CHAR(${transaction.date}, '${sql.raw(dateFormat)}')`,
               value: aggregateSql,
            })
            .from(transaction)
            .where(and(...prevConditions))
            .groupBy(
               sql`TO_CHAR(${transaction.date}, '${sql.raw(dateFormat)}')`,
            )
            .orderBy(
               asc(sql`TO_CHAR(${transaction.date}, '${sql.raw(dateFormat)}')`),
            );

         result.comparisonTimeSeries = comparisonTimeSeriesResult.map(
            (row: { date: string; value: number }) => ({
               date: row.date,
               value: row.value,
            }),
         );
      }
   }

   // Handle table output
   if (config.chartType === "table") {
      const tableResult = await db
         .select({
            amount: transaction.amount,
            date: transaction.date,
            description: transaction.description,
            id: transaction.id,
            type: transaction.type,
         })
         .from(transaction)
         .where(whereClause)
         .orderBy(desc(transaction.date))
         .limit(100);

      // Decrypt sensitive fields before returning
      result.tableData = tableResult.map(
         (row: { description?: string | null; notes?: string | null }) =>
            decryptTransactionFields(row),
      );
   }

   return result;
}

async function queryBillInsight(
   db: any,
   organizationId: string,
   config: InsightConfig,
   startDate: Date,
   endDate: Date,
   _globalFilters?: DashboardFilterConfig,
): Promise<InsightResult> {
   const baseConditions = [
      eq(bill.organizationId, organizationId),
      gte(bill.dueDate, startDate),
      lte(bill.dueDate, endDate),
   ];

   // Apply filters from config
   for (const filter of config.filters) {
      if (filter.field === "type" && filter.operator === "equals") {
         baseConditions.push(eq(bill.type, filter.value as string));
      }
      if (filter.field === "isPaid" && filter.operator === "equals") {
         if (filter.value === "true" || filter.value === 1) {
            baseConditions.push(sql`${bill.completionDate} IS NOT NULL`);
         } else {
            baseConditions.push(sql`${bill.completionDate} IS NULL`);
         }
      }
   }

   const whereClause = and(...baseConditions);

   // Build aggregation SQL
   let aggregateSql: ReturnType<typeof sql<number>>;
   switch (config.aggregation) {
      case "sum":
         aggregateSql = sql<number>`COALESCE(SUM(CAST(${bill.amount} AS REAL)), 0)`;
         break;
      case "count":
         aggregateSql = sql<number>`COUNT(*)`;
         break;
      case "average":
         aggregateSql = sql<number>`COALESCE(AVG(CAST(${bill.amount} AS REAL)), 0)`;
         break;
      default:
         aggregateSql = sql<number>`COALESCE(SUM(CAST(${bill.amount} AS REAL)), 0)`;
   }

   const mainResult = await db
      .select({ value: aggregateSql })
      .from(bill)
      .where(whereClause);

   const result: InsightResult = {
      value: mainResult[0]?.value || 0,
   };

   // Handle time series (generate regardless of chart type for flexibility)
   if (config.timeGrouping) {
      let dateFormat: string;
      switch (config.timeGrouping) {
         case "day":
            dateFormat = "YYYY-MM-DD";
            break;
         case "week":
            dateFormat = "IYYY-IW";
            break;
         case "month":
            dateFormat = "YYYY-MM";
            break;
         case "quarter":
            dateFormat = 'YYYY-"Q"Q';
            break;
         case "year":
            dateFormat = "YYYY";
            break;
         default:
            dateFormat = "YYYY-MM";
      }

      const timeSeriesResult = await db
         .select({
            date: sql<string>`TO_CHAR(${bill.dueDate}, '${sql.raw(dateFormat)}')`,
            value: aggregateSql,
         })
         .from(bill)
         .where(whereClause)
         .groupBy(sql`TO_CHAR(${bill.dueDate}, '${sql.raw(dateFormat)}')`)
         .orderBy(asc(sql`TO_CHAR(${bill.dueDate}, '${sql.raw(dateFormat)}')`));

      result.timeSeries = timeSeriesResult.map(
         (row: { date: string; value: number }) => ({
            date: row.date,
            value: row.value,
         }),
      );
   }

   // Handle breakdown by type (generate regardless of chart type for flexibility)
   if (config.breakdown?.field === "type") {
      const breakdownResult = await db
         .select({
            label: bill.type,
            value: aggregateSql,
         })
         .from(bill)
         .where(whereClause)
         .groupBy(bill.type);

      result.breakdown = breakdownResult.map(
         (row: { label: string; value: number }) => ({
            color: row.label === "income" ? "#10b981" : "#ef4444",
            label: row.label,
            value: row.value,
         }),
      );
   }

   return result;
}

async function queryBudgetInsight(
   db: any,
   organizationId: string,
   config: InsightConfig,
   startDate: Date,
   endDate: Date,
): Promise<InsightResult> {
   // Get active budgets with periods in the date range
   const budgets = await db.query.budget.findMany({
      where: (b: any, { eq: eqOp, and: andOp }: any) =>
         andOp(eqOp(b.organizationId, organizationId), eqOp(b.isActive, true)),
      with: {
         periods: {
            where: (p: any, { and: andOp, gte: gteOp, lte: lteOp }: any) =>
               andOp(
                  gteOp(p.periodStart, startDate),
                  lteOp(p.periodEnd, endDate),
               ),
         },
      },
   });

   let totalBudgeted = 0;
   let totalSpent = 0;

   for (const b of budgets) {
      for (const period of b.periods) {
         totalBudgeted += Number(period.totalAmount);
         totalSpent += Number(period.spentAmount || 0);
      }
   }

   const result: InsightResult = {
      value: config.aggregateField === "spent" ? totalSpent : totalBudgeted,
   };

   // Always generate breakdown (spent vs remaining)
   result.breakdown = [
      { color: "#ef4444", label: "Spent", value: totalSpent },
      {
         color: "#10b981",
         label: "Remaining",
         value: Math.max(0, totalBudgeted - totalSpent),
      },
   ];

   // Handle time series by grouping budget periods
   if (config.timeGrouping) {
      const periodsByTime = new Map<string, number>();

      for (const b of budgets) {
         for (const period of b.periods) {
            const periodDate = new Date(period.periodStart);
            let dateKey: string;

            switch (config.timeGrouping) {
               case "day":
                  dateKey = periodDate.toISOString().slice(0, 10);
                  break;
               case "week": {
                  const year = periodDate.getFullYear();
                  const week = Math.ceil(
                     ((periodDate.getTime() - new Date(year, 0, 1).getTime()) /
                        86400000 +
                        1) /
                        7,
                  );
                  dateKey = `${year}-W${String(week).padStart(2, "0")}`;
                  break;
               }
               case "month":
                  dateKey = `${periodDate.getFullYear()}-${String(periodDate.getMonth() + 1).padStart(2, "0")}`;
                  break;
               case "quarter": {
                  const quarter = Math.ceil((periodDate.getMonth() + 1) / 3);
                  dateKey = `${periodDate.getFullYear()}-Q${quarter}`;
                  break;
               }
               case "year":
                  dateKey = String(periodDate.getFullYear());
                  break;
               default:
                  dateKey = `${periodDate.getFullYear()}-${String(periodDate.getMonth() + 1).padStart(2, "0")}`;
            }

            const value =
               config.aggregateField === "spent"
                  ? Number(period.spentAmount || 0)
                  : Number(period.totalAmount);
            const existing = periodsByTime.get(dateKey) || 0;
            periodsByTime.set(dateKey, existing + value);
         }
      }

      result.timeSeries = Array.from(periodsByTime.entries())
         .sort(([a], [b]) => a.localeCompare(b))
         .map(([date, value]) => ({ date, value }));
   }

   return result;
}

async function queryBankAccountInsight(
   db: any,
   organizationId: string,
   _config: InsightConfig,
   globalFilters?: DashboardFilterConfig,
): Promise<InsightResult> {
   const baseConditions = [eq(bankAccount.organizationId, organizationId)];

   if (globalFilters?.bankAccountIds?.length) {
      baseConditions.push(
         inArray(bankAccount.id, globalFilters.bankAccountIds),
      );
   }

   const whereClause = and(...baseConditions);

   // Get bank accounts
   const accounts = await db
      .select({
         id: bankAccount.id,
         name: bankAccount.name,
         bank: bankAccount.bank,
      })
      .from(bankAccount)
      .where(whereClause);

   // Calculate balance from transactions for each account
   const accountBalances = await Promise.all(
      accounts.map(
         async (account: {
            id: string;
            name: string | null;
            bank: string | null;
         }) => {
            const balanceResult = await db
               .select({
                  balance: sql<number>`COALESCE(
						SUM(CASE
							WHEN ${transaction.type} = 'income' THEN CAST(${transaction.amount} AS REAL)
							ELSE -CAST(${transaction.amount} AS REAL)
						END),
						0
					)`,
               })
               .from(transaction)
               .where(
                  and(
                     eq(transaction.organizationId, organizationId),
                     eq(transaction.bankAccountId, account.id),
                  ),
               );

            return {
               balance: balanceResult[0]?.balance || 0,
               bank: account.bank,
               id: account.id,
               name: account.name,
            };
         },
      ),
   );

   const totalBalance = accountBalances.reduce(
      (sum, acc) => sum + acc.balance,
      0,
   );

   const result: InsightResult = {
      value: totalBalance,
   };

   // Always generate breakdown by account (no time series for bank accounts - point-in-time data)
   result.breakdown = accountBalances.map((acc) => ({
      label: acc.name || acc.bank || "Unknown",
      value: acc.balance,
   }));

   // Always generate table data
   result.tableData = accountBalances;

   return result;
}
