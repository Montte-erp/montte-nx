import { z } from "zod";
export declare const insightTypeEnum: readonly [
   "kpi",
   "time_series",
   "breakdown",
];
export declare const insightSizeEnum: readonly ["sm", "md", "lg", "full"];
export declare const insightConfigSchema: z.ZodRecord<
   z.ZodString,
   z.ZodUnknown
>;
export type InsightConfig = z.infer<typeof insightConfigSchema>;
export declare const insights: import("drizzle-orm/pg-core").PgTableWithColumns<{
   name: "insights";
   schema: undefined;
   columns: {
      id: import("drizzle-orm/pg-core").PgBuildColumn<
         "insights",
         import("drizzle-orm/pg-core").SetIsPrimaryKey<
            import("drizzle-orm/pg-core").SetHasDefault<
               import("drizzle-orm/pg-core").PgUUIDBuilder
            >
         >,
         {
            name: string;
            tableName: "insights";
            dataType: "string uuid";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            identity: undefined;
            generated: undefined;
         }
      >;
      organizationId: import("drizzle-orm/pg-core").PgBuildColumn<
         "insights",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgUUIDBuilder
         >,
         {
            name: string;
            tableName: "insights";
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
      teamId: import("drizzle-orm/pg-core").PgBuildColumn<
         "insights",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgUUIDBuilder
         >,
         {
            name: string;
            tableName: "insights";
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
      createdBy: import("drizzle-orm/pg-core").PgBuildColumn<
         "insights",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgUUIDBuilder
         >,
         {
            name: string;
            tableName: "insights";
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
      name: import("drizzle-orm/pg-core").PgBuildColumn<
         "insights",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>
         >,
         {
            name: string;
            tableName: "insights";
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
      description: import("drizzle-orm/pg-core").PgBuildColumn<
         "insights",
         import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>,
         {
            name: string;
            tableName: "insights";
            dataType: "string";
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
      type: import("drizzle-orm/pg-core").PgBuildColumn<
         "insights",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>
         >,
         {
            name: string;
            tableName: "insights";
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
      config: import("drizzle-orm/pg-core").PgBuildColumn<
         "insights",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").Set$Type<
               import("drizzle-orm/pg-core").PgJsonbBuilder,
               Record<string, unknown>
            >
         >,
         {
            name: string;
            tableName: "insights";
            dataType: "object json";
            data: Record<string, unknown>;
            driverParam: unknown;
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
      defaultSize: import("drizzle-orm/pg-core").PgBuildColumn<
         "insights",
         import("drizzle-orm/pg-core").SetHasDefault<
            import("drizzle-orm/pg-core").SetNotNull<
               import("drizzle-orm/pg-core").PgTextBuilder<
                  [string, ...string[]]
               >
            >
         >,
         {
            name: string;
            tableName: "insights";
            dataType: "string";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            identity: undefined;
            generated: undefined;
         }
      >;
      cachedResults: import("drizzle-orm/pg-core").PgBuildColumn<
         "insights",
         import("drizzle-orm/pg-core").Set$Type<
            import("drizzle-orm/pg-core").PgJsonbBuilder,
            Record<string, unknown>
         >,
         {
            name: string;
            tableName: "insights";
            dataType: "object json";
            data: Record<string, unknown>;
            driverParam: unknown;
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
      lastComputedAt: import("drizzle-orm/pg-core").PgBuildColumn<
         "insights",
         import("drizzle-orm/pg-core").PgTimestampBuilder,
         {
            name: string;
            tableName: "insights";
            dataType: "object date";
            data: Date;
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
      createdAt: import("drizzle-orm/pg-core").PgBuildColumn<
         "insights",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").SetHasDefault<
               import("drizzle-orm/pg-core").PgTimestampBuilder
            >
         >,
         {
            name: string;
            tableName: "insights";
            dataType: "object date";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            identity: undefined;
            generated: undefined;
         }
      >;
      updatedAt: import("drizzle-orm/pg-core").PgBuildColumn<
         "insights",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").SetHasDefault<
               import("drizzle-orm/pg-core").SetHasDefault<
                  import("drizzle-orm/pg-core").PgTimestampBuilder
               >
            >
         >,
         {
            name: string;
            tableName: "insights";
            dataType: "object date";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            identity: undefined;
            generated: undefined;
         }
      >;
   };
   dialect: "pg";
}>;
export type Insight = typeof insights.$inferSelect;
export type NewInsight = typeof insights.$inferInsert;
export declare const createInsightSchema: z.ZodObject<
   {
      name: z.ZodString;
      description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
      type: z.ZodEnum<{
         breakdown: "breakdown";
         kpi: "kpi";
         time_series: "time_series";
      }>;
      config: z.ZodRecord<z.ZodString, z.ZodUnknown>;
      defaultSize: z.ZodDefault<
         z.ZodEnum<{
            full: "full";
            lg: "lg";
            md: "md";
            sm: "sm";
         }>
      >;
   },
   {
      out: {};
      in: {};
   }
>;
export declare const updateInsightSchema: z.ZodObject<
   {
      name: z.ZodOptional<z.ZodString>;
      description: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
      type: z.ZodOptional<
         z.ZodEnum<{
            breakdown: "breakdown";
            kpi: "kpi";
            time_series: "time_series";
         }>
      >;
      config: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
      defaultSize: z.ZodOptional<
         z.ZodDefault<
            z.ZodEnum<{
               full: "full";
               lg: "lg";
               md: "md";
               sm: "sm";
            }>
         >
      >;
   },
   {
      out: {};
      in: {};
   }
>;
export type CreateInsightInput = z.infer<typeof createInsightSchema>;
export type UpdateInsightInput = z.infer<typeof updateInsightSchema>;
//# sourceMappingURL=insights.d.ts.map
