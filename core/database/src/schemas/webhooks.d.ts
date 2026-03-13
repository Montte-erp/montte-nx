import { z } from "zod";
export declare const webhookEndpoints: import("drizzle-orm/pg-core").PgTableWithColumns<{
   name: "webhook_endpoints";
   schema: undefined;
   columns: {
      id: import("drizzle-orm/pg-core").PgBuildColumn<
         "webhook_endpoints",
         import("drizzle-orm/pg-core").SetIsPrimaryKey<
            import("drizzle-orm/pg-core").SetHasDefault<
               import("drizzle-orm/pg-core").PgUUIDBuilder
            >
         >,
         {
            name: string;
            tableName: "webhook_endpoints";
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
         "webhook_endpoints",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgUUIDBuilder
         >,
         {
            name: string;
            tableName: "webhook_endpoints";
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
         "webhook_endpoints",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgUUIDBuilder
         >,
         {
            name: string;
            tableName: "webhook_endpoints";
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
      url: import("drizzle-orm/pg-core").PgBuildColumn<
         "webhook_endpoints",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>
         >,
         {
            name: string;
            tableName: "webhook_endpoints";
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
         "webhook_endpoints",
         import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>,
         {
            name: string;
            tableName: "webhook_endpoints";
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
      eventPatterns: import("drizzle-orm/pg-core").PgBuildColumn<
         "webhook_endpoints",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").Set$Type<
               import("drizzle-orm/pg-core").PgJsonbBuilder,
               string[]
            >
         >,
         {
            name: string;
            tableName: "webhook_endpoints";
            dataType: "object json";
            data: string[];
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
      signingSecret: import("drizzle-orm/pg-core").PgBuildColumn<
         "webhook_endpoints",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>
         >,
         {
            name: string;
            tableName: "webhook_endpoints";
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
      apiKeyId: import("drizzle-orm/pg-core").PgBuildColumn<
         "webhook_endpoints",
         import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>,
         {
            name: string;
            tableName: "webhook_endpoints";
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
      isActive: import("drizzle-orm/pg-core").PgBuildColumn<
         "webhook_endpoints",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").SetHasDefault<
               import("drizzle-orm/pg-core").PgBooleanBuilder
            >
         >,
         {
            name: string;
            tableName: "webhook_endpoints";
            dataType: "boolean";
            data: boolean;
            driverParam: boolean;
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
      failureCount: import("drizzle-orm/pg-core").PgBuildColumn<
         "webhook_endpoints",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").SetHasDefault<
               import("drizzle-orm/pg-core").PgIntegerBuilder
            >
         >,
         {
            name: string;
            tableName: "webhook_endpoints";
            dataType: "number int32";
            data: number;
            driverParam: string | number;
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
      lastSuccessAt: import("drizzle-orm/pg-core").PgBuildColumn<
         "webhook_endpoints",
         import("drizzle-orm/pg-core").PgTimestampBuilder,
         {
            name: string;
            tableName: "webhook_endpoints";
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
      lastFailureAt: import("drizzle-orm/pg-core").PgBuildColumn<
         "webhook_endpoints",
         import("drizzle-orm/pg-core").PgTimestampBuilder,
         {
            name: string;
            tableName: "webhook_endpoints";
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
         "webhook_endpoints",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").SetHasDefault<
               import("drizzle-orm/pg-core").PgTimestampBuilder
            >
         >,
         {
            name: string;
            tableName: "webhook_endpoints";
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
         "webhook_endpoints",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").SetHasDefault<
               import("drizzle-orm/pg-core").SetHasDefault<
                  import("drizzle-orm/pg-core").PgTimestampBuilder
               >
            >
         >,
         {
            name: string;
            tableName: "webhook_endpoints";
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
export declare const webhookDeliveries: import("drizzle-orm/pg-core").PgTableWithColumns<{
   name: "webhook_deliveries";
   schema: undefined;
   columns: {
      id: import("drizzle-orm/pg-core").PgBuildColumn<
         "webhook_deliveries",
         import("drizzle-orm/pg-core").SetIsPrimaryKey<
            import("drizzle-orm/pg-core").SetHasDefault<
               import("drizzle-orm/pg-core").PgUUIDBuilder
            >
         >,
         {
            name: string;
            tableName: "webhook_deliveries";
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
      webhookEndpointId: import("drizzle-orm/pg-core").PgBuildColumn<
         "webhook_deliveries",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgUUIDBuilder
         >,
         {
            name: string;
            tableName: "webhook_deliveries";
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
      eventId: import("drizzle-orm/pg-core").PgBuildColumn<
         "webhook_deliveries",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgUUIDBuilder
         >,
         {
            name: string;
            tableName: "webhook_deliveries";
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
      url: import("drizzle-orm/pg-core").PgBuildColumn<
         "webhook_deliveries",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>
         >,
         {
            name: string;
            tableName: "webhook_deliveries";
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
      eventName: import("drizzle-orm/pg-core").PgBuildColumn<
         "webhook_deliveries",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>
         >,
         {
            name: string;
            tableName: "webhook_deliveries";
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
      payload: import("drizzle-orm/pg-core").PgBuildColumn<
         "webhook_deliveries",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").Set$Type<
               import("drizzle-orm/pg-core").PgJsonbBuilder,
               Record<string, unknown>
            >
         >,
         {
            name: string;
            tableName: "webhook_deliveries";
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
      status: import("drizzle-orm/pg-core").PgBuildColumn<
         "webhook_deliveries",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>
         >,
         {
            name: string;
            tableName: "webhook_deliveries";
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
      httpStatusCode: import("drizzle-orm/pg-core").PgBuildColumn<
         "webhook_deliveries",
         import("drizzle-orm/pg-core").PgIntegerBuilder,
         {
            name: string;
            tableName: "webhook_deliveries";
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
      responseBody: import("drizzle-orm/pg-core").PgBuildColumn<
         "webhook_deliveries",
         import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>,
         {
            name: string;
            tableName: "webhook_deliveries";
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
      errorMessage: import("drizzle-orm/pg-core").PgBuildColumn<
         "webhook_deliveries",
         import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>,
         {
            name: string;
            tableName: "webhook_deliveries";
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
      attemptNumber: import("drizzle-orm/pg-core").PgBuildColumn<
         "webhook_deliveries",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").SetHasDefault<
               import("drizzle-orm/pg-core").PgIntegerBuilder
            >
         >,
         {
            name: string;
            tableName: "webhook_deliveries";
            dataType: "number int32";
            data: number;
            driverParam: string | number;
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
      maxAttempts: import("drizzle-orm/pg-core").PgBuildColumn<
         "webhook_deliveries",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").SetHasDefault<
               import("drizzle-orm/pg-core").PgIntegerBuilder
            >
         >,
         {
            name: string;
            tableName: "webhook_deliveries";
            dataType: "number int32";
            data: number;
            driverParam: string | number;
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
      nextRetryAt: import("drizzle-orm/pg-core").PgBuildColumn<
         "webhook_deliveries",
         import("drizzle-orm/pg-core").PgTimestampBuilder,
         {
            name: string;
            tableName: "webhook_deliveries";
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
         "webhook_deliveries",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").SetHasDefault<
               import("drizzle-orm/pg-core").PgTimestampBuilder
            >
         >,
         {
            name: string;
            tableName: "webhook_deliveries";
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
      deliveredAt: import("drizzle-orm/pg-core").PgBuildColumn<
         "webhook_deliveries",
         import("drizzle-orm/pg-core").PgTimestampBuilder,
         {
            name: string;
            tableName: "webhook_deliveries";
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
   };
   dialect: "pg";
}>;
export type WebhookEndpoint = typeof webhookEndpoints.$inferSelect;
export type NewWebhookEndpoint = typeof webhookEndpoints.$inferInsert;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type NewWebhookDelivery = typeof webhookDeliveries.$inferInsert;
export declare const createWebhookEndpointSchema: z.ZodObject<
   {
      url: z.ZodString;
      description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
      eventPatterns: z.ZodArray<z.ZodString>;
      isActive: z.ZodDefault<z.ZodBoolean>;
   },
   {
      out: {};
      in: {};
   }
>;
export declare const updateWebhookEndpointSchema: z.ZodObject<
   {
      url: z.ZodOptional<z.ZodString>;
      description: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
      eventPatterns: z.ZodOptional<z.ZodArray<z.ZodString>>;
      isActive: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
   },
   {
      out: {};
      in: {};
   }
>;
export type CreateWebhookEndpointInput = z.infer<
   typeof createWebhookEndpointSchema
>;
export type UpdateWebhookEndpointInput = z.infer<
   typeof updateWebhookEndpointSchema
>;
//# sourceMappingURL=webhooks.d.ts.map
