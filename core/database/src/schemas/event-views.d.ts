export declare const dailyUsageByEvent: import("drizzle-orm/pg-core").PgMaterializedViewWithSelection<
   "daily_usage_by_event",
   false,
   {
      organizationId: import("drizzle-orm/pg-core").PgBuildColumn<
         "daily_usage_by_event",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgUUIDBuilder
         >,
         {
            name: string;
            tableName: "daily_usage_by_event";
            dataType: "string uuid";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            identity: undefined;
            generated: undefined;
         }
      >;
      eventName: import("drizzle-orm/pg-core").PgBuildColumn<
         "daily_usage_by_event",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>
         >,
         {
            name: string;
            tableName: "daily_usage_by_event";
            dataType: "string";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            identity: undefined;
            generated: undefined;
         }
      >;
      eventCategory: import("drizzle-orm/pg-core").PgBuildColumn<
         "daily_usage_by_event",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>
         >,
         {
            name: string;
            tableName: "daily_usage_by_event";
            dataType: "string";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            identity: undefined;
            generated: undefined;
         }
      >;
      date: import("drizzle-orm/pg-core").PgBuildColumn<
         "daily_usage_by_event",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgDateStringBuilder
         >,
         {
            name: string;
            tableName: "daily_usage_by_event";
            dataType: "string date";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            identity: undefined;
            generated: undefined;
         }
      >;
      eventCount: import("drizzle-orm/pg-core").PgBuildColumn<
         "daily_usage_by_event",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgIntegerBuilder
         >,
         {
            name: string;
            tableName: "daily_usage_by_event";
            dataType: "number int32";
            data: number;
            driverParam: string | number;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            identity: undefined;
            generated: undefined;
         }
      >;
      totalCost: import("drizzle-orm/pg-core").PgBuildColumn<
         "daily_usage_by_event",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgNumericBuilder
         >,
         {
            name: string;
            tableName: "daily_usage_by_event";
            dataType: "string numeric";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            identity: undefined;
            generated: undefined;
         }
      >;
   }
>;
export declare const currentMonthUsageByEvent: import("drizzle-orm/pg-core").PgMaterializedViewWithSelection<
   "current_month_usage_by_event",
   false,
   {
      organizationId: import("drizzle-orm/pg-core").PgBuildColumn<
         "current_month_usage_by_event",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgUUIDBuilder
         >,
         {
            name: string;
            tableName: "current_month_usage_by_event";
            dataType: "string uuid";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            identity: undefined;
            generated: undefined;
         }
      >;
      eventName: import("drizzle-orm/pg-core").PgBuildColumn<
         "current_month_usage_by_event",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>
         >,
         {
            name: string;
            tableName: "current_month_usage_by_event";
            dataType: "string";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            identity: undefined;
            generated: undefined;
         }
      >;
      eventCategory: import("drizzle-orm/pg-core").PgBuildColumn<
         "current_month_usage_by_event",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>
         >,
         {
            name: string;
            tableName: "current_month_usage_by_event";
            dataType: "string";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            identity: undefined;
            generated: undefined;
         }
      >;
      eventCount: import("drizzle-orm/pg-core").PgBuildColumn<
         "current_month_usage_by_event",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgIntegerBuilder
         >,
         {
            name: string;
            tableName: "current_month_usage_by_event";
            dataType: "number int32";
            data: number;
            driverParam: string | number;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            identity: undefined;
            generated: undefined;
         }
      >;
      monthToDateCost: import("drizzle-orm/pg-core").PgBuildColumn<
         "current_month_usage_by_event",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgNumericBuilder
         >,
         {
            name: string;
            tableName: "current_month_usage_by_event";
            dataType: "string numeric";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            identity: undefined;
            generated: undefined;
         }
      >;
   }
>;
export declare const currentMonthUsageByCategory: import("drizzle-orm/pg-core").PgMaterializedViewWithSelection<
   "current_month_usage_by_category",
   false,
   {
      organizationId: import("drizzle-orm/pg-core").PgBuildColumn<
         "current_month_usage_by_category",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgUUIDBuilder
         >,
         {
            name: string;
            tableName: "current_month_usage_by_category";
            dataType: "string uuid";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            identity: undefined;
            generated: undefined;
         }
      >;
      eventCategory: import("drizzle-orm/pg-core").PgBuildColumn<
         "current_month_usage_by_category",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>
         >,
         {
            name: string;
            tableName: "current_month_usage_by_category";
            dataType: "string";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            identity: undefined;
            generated: undefined;
         }
      >;
      eventCount: import("drizzle-orm/pg-core").PgBuildColumn<
         "current_month_usage_by_category",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgIntegerBuilder
         >,
         {
            name: string;
            tableName: "current_month_usage_by_category";
            dataType: "number int32";
            data: number;
            driverParam: string | number;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            identity: undefined;
            generated: undefined;
         }
      >;
      monthToDateCost: import("drizzle-orm/pg-core").PgBuildColumn<
         "current_month_usage_by_category",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgNumericBuilder
         >,
         {
            name: string;
            tableName: "current_month_usage_by_category";
            dataType: "string numeric";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            identity: undefined;
            generated: undefined;
         }
      >;
      projectedCost: import("drizzle-orm/pg-core").PgBuildColumn<
         "current_month_usage_by_category",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgNumericBuilder
         >,
         {
            name: string;
            tableName: "current_month_usage_by_category";
            dataType: "string numeric";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            identity: undefined;
            generated: undefined;
         }
      >;
   }
>;
export declare const monthlyAiUsage: import("drizzle-orm/pg-core").PgMaterializedViewWithSelection<
   "monthly_ai_usage",
   false,
   {
      organizationId: import("drizzle-orm/pg-core").PgBuildColumn<
         "monthly_ai_usage",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgUUIDBuilder
         >,
         {
            name: string;
            tableName: "monthly_ai_usage";
            dataType: "string uuid";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            identity: undefined;
            generated: undefined;
         }
      >;
      month: import("drizzle-orm/pg-core").PgBuildColumn<
         "monthly_ai_usage",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgDateStringBuilder
         >,
         {
            name: string;
            tableName: "monthly_ai_usage";
            dataType: "string date";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            identity: undefined;
            generated: undefined;
         }
      >;
      completions: import("drizzle-orm/pg-core").PgBuildColumn<
         "monthly_ai_usage",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgIntegerBuilder
         >,
         {
            name: string;
            tableName: "monthly_ai_usage";
            dataType: "number int32";
            data: number;
            driverParam: string | number;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            identity: undefined;
            generated: undefined;
         }
      >;
      chatMessages: import("drizzle-orm/pg-core").PgBuildColumn<
         "monthly_ai_usage",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgIntegerBuilder
         >,
         {
            name: string;
            tableName: "monthly_ai_usage";
            dataType: "number int32";
            data: number;
            driverParam: string | number;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            identity: undefined;
            generated: undefined;
         }
      >;
      agentActions: import("drizzle-orm/pg-core").PgBuildColumn<
         "monthly_ai_usage",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgIntegerBuilder
         >,
         {
            name: string;
            tableName: "monthly_ai_usage";
            dataType: "number int32";
            data: number;
            driverParam: string | number;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            identity: undefined;
            generated: undefined;
         }
      >;
      totalTokens: import("drizzle-orm/pg-core").PgBuildColumn<
         "monthly_ai_usage",
         import("drizzle-orm/pg-core").PgIntegerBuilder,
         {
            name: string;
            tableName: "monthly_ai_usage";
            dataType: "number int32";
            data: number;
            driverParam: string | number;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            identity: undefined;
            generated: undefined;
         }
      >;
      promptTokens: import("drizzle-orm/pg-core").PgBuildColumn<
         "monthly_ai_usage",
         import("drizzle-orm/pg-core").PgIntegerBuilder,
         {
            name: string;
            tableName: "monthly_ai_usage";
            dataType: "number int32";
            data: number;
            driverParam: string | number;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            identity: undefined;
            generated: undefined;
         }
      >;
      completionTokens: import("drizzle-orm/pg-core").PgBuildColumn<
         "monthly_ai_usage",
         import("drizzle-orm/pg-core").PgIntegerBuilder,
         {
            name: string;
            tableName: "monthly_ai_usage";
            dataType: "number int32";
            data: number;
            driverParam: string | number;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            identity: undefined;
            generated: undefined;
         }
      >;
      avgLatencyMs: import("drizzle-orm/pg-core").PgBuildColumn<
         "monthly_ai_usage",
         import("drizzle-orm/pg-core").PgNumericBuilder,
         {
            name: string;
            tableName: "monthly_ai_usage";
            dataType: "string numeric";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            identity: undefined;
            generated: undefined;
         }
      >;
   }
>;
export declare const dailyEventCounts: import("drizzle-orm/pg-core").PgMaterializedViewWithSelection<
   "daily_event_counts",
   false,
   {
      organizationId: import("drizzle-orm/pg-core").PgBuildColumn<
         "daily_event_counts",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgUUIDBuilder
         >,
         {
            name: string;
            tableName: "daily_event_counts";
            dataType: "string uuid";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            identity: undefined;
            generated: undefined;
         }
      >;
      eventName: import("drizzle-orm/pg-core").PgBuildColumn<
         "daily_event_counts",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>
         >,
         {
            name: string;
            tableName: "daily_event_counts";
            dataType: "string";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            identity: undefined;
            generated: undefined;
         }
      >;
      eventCategory: import("drizzle-orm/pg-core").PgBuildColumn<
         "daily_event_counts",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>
         >,
         {
            name: string;
            tableName: "daily_event_counts";
            dataType: "string";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            identity: undefined;
            generated: undefined;
         }
      >;
      date: import("drizzle-orm/pg-core").PgBuildColumn<
         "daily_event_counts",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgDateStringBuilder
         >,
         {
            name: string;
            tableName: "daily_event_counts";
            dataType: "string date";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            identity: undefined;
            generated: undefined;
         }
      >;
      eventCount: import("drizzle-orm/pg-core").PgBuildColumn<
         "daily_event_counts",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgIntegerBuilder
         >,
         {
            name: string;
            tableName: "daily_event_counts";
            dataType: "number int32";
            data: number;
            driverParam: string | number;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            identity: undefined;
            generated: undefined;
         }
      >;
      uniqueUsers: import("drizzle-orm/pg-core").PgBuildColumn<
         "daily_event_counts",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgIntegerBuilder
         >,
         {
            name: string;
            tableName: "daily_event_counts";
            dataType: "number int32";
            data: number;
            driverParam: string | number;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            identity: undefined;
            generated: undefined;
         }
      >;
   }
>;
export declare const currentMonthStorageCost: import("drizzle-orm/pg-core").PgMaterializedViewWithSelection<
   "current_month_storage_cost",
   false,
   {
      organizationId: import("drizzle-orm/pg-core").PgBuildColumn<
         "current_month_storage_cost",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgUUIDBuilder
         >,
         {
            name: string;
            tableName: "current_month_storage_cost";
            dataType: "string uuid";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            identity: undefined;
            generated: undefined;
         }
      >;
      currentBytes: import("drizzle-orm/pg-core").PgBuildColumn<
         "current_month_storage_cost",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgBigInt64Builder
         >,
         {
            name: string;
            tableName: "current_month_storage_cost";
            dataType: "bigint int64";
            data: bigint;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            identity: undefined;
            generated: undefined;
         }
      >;
      monthToDateCost: import("drizzle-orm/pg-core").PgBuildColumn<
         "current_month_storage_cost",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgNumericBuilder
         >,
         {
            name: string;
            tableName: "current_month_storage_cost";
            dataType: "string numeric";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            identity: undefined;
            generated: undefined;
         }
      >;
      projectedCost: import("drizzle-orm/pg-core").PgBuildColumn<
         "current_month_storage_cost",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgNumericBuilder
         >,
         {
            name: string;
            tableName: "current_month_storage_cost";
            dataType: "string numeric";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            identity: undefined;
            generated: undefined;
         }
      >;
   }
>;
//# sourceMappingURL=event-views.d.ts.map
