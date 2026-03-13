import { z } from "zod";
export declare const billingCycleEnum: import("drizzle-orm/pg-core").PgEnum<
   ["hourly", "monthly", "annual", "one_time"]
>;
export declare const subscriptionStatusEnum: import("drizzle-orm/pg-core").PgEnum<
   ["active", "completed", "cancelled"]
>;
export type BillingCycle = (typeof billingCycleEnum.enumValues)[number];
export type SubscriptionStatus =
   (typeof subscriptionStatusEnum.enumValues)[number];
export declare const contactSubscriptions: import("drizzle-orm/pg-core").PgTableWithColumns<{
   name: "contact_subscriptions";
   schema: undefined;
   columns: {
      id: import("drizzle-orm/pg-core").PgBuildColumn<
         "contact_subscriptions",
         import("drizzle-orm/pg-core").SetIsPrimaryKey<
            import("drizzle-orm/pg-core").SetHasDefault<
               import("drizzle-orm/pg-core").PgUUIDBuilder
            >
         >,
         {
            name: string;
            tableName: "contact_subscriptions";
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
      teamId: import("drizzle-orm/pg-core").PgBuildColumn<
         "contact_subscriptions",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgUUIDBuilder
         >,
         {
            name: string;
            tableName: "contact_subscriptions";
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
      contactId: import("drizzle-orm/pg-core").PgBuildColumn<
         "contact_subscriptions",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgUUIDBuilder
         >,
         {
            name: string;
            tableName: "contact_subscriptions";
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
      variantId: import("drizzle-orm/pg-core").PgBuildColumn<
         "contact_subscriptions",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgUUIDBuilder
         >,
         {
            name: string;
            tableName: "contact_subscriptions";
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
      startDate: import("drizzle-orm/pg-core").PgBuildColumn<
         "contact_subscriptions",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgDateStringBuilder
         >,
         {
            name: string;
            tableName: "contact_subscriptions";
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
      endDate: import("drizzle-orm/pg-core").PgBuildColumn<
         "contact_subscriptions",
         import("drizzle-orm/pg-core").PgDateStringBuilder,
         {
            name: string;
            tableName: "contact_subscriptions";
            dataType: "string date";
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
      negotiatedPrice: import("drizzle-orm/pg-core").PgBuildColumn<
         "contact_subscriptions",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgNumericBuilder
         >,
         {
            name: string;
            tableName: "contact_subscriptions";
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
      notes: import("drizzle-orm/pg-core").PgBuildColumn<
         "contact_subscriptions",
         import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>,
         {
            name: string;
            tableName: "contact_subscriptions";
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
      status: import("drizzle-orm/pg-core").PgBuildColumn<
         "contact_subscriptions",
         import("drizzle-orm/pg-core").SetHasDefault<
            import("drizzle-orm/pg-core").SetNotNull<
               import("drizzle-orm/pg-core").PgEnumColumnBuilder<
                  ["active", "completed", "cancelled"]
               >
            >
         >,
         {
            name: string;
            tableName: "contact_subscriptions";
            dataType: "string enum";
            data: "active" | "cancelled" | "completed";
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: ["active", "completed", "cancelled"];
            identity: undefined;
            generated: undefined;
         }
      >;
      source: import("drizzle-orm/pg-core").PgBuildColumn<
         "contact_subscriptions",
         import("drizzle-orm/pg-core").SetHasDefault<
            import("drizzle-orm/pg-core").SetNotNull<
               import("drizzle-orm/pg-core").PgEnumColumnBuilder<
                  ["manual", "asaas"]
               >
            >
         >,
         {
            name: string;
            tableName: "contact_subscriptions";
            dataType: "string enum";
            data: "asaas" | "manual";
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: ["manual", "asaas"];
            identity: undefined;
            generated: undefined;
         }
      >;
      externalId: import("drizzle-orm/pg-core").PgBuildColumn<
         "contact_subscriptions",
         import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>,
         {
            name: string;
            tableName: "contact_subscriptions";
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
      currentPeriodStart: import("drizzle-orm/pg-core").PgBuildColumn<
         "contact_subscriptions",
         import("drizzle-orm/pg-core").PgDateStringBuilder,
         {
            name: string;
            tableName: "contact_subscriptions";
            dataType: "string date";
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
      currentPeriodEnd: import("drizzle-orm/pg-core").PgBuildColumn<
         "contact_subscriptions",
         import("drizzle-orm/pg-core").PgDateStringBuilder,
         {
            name: string;
            tableName: "contact_subscriptions";
            dataType: "string date";
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
      cancelAtPeriodEnd: import("drizzle-orm/pg-core").PgBuildColumn<
         "contact_subscriptions",
         import("drizzle-orm/pg-core").SetHasDefault<
            import("drizzle-orm/pg-core").SetNotNull<
               import("drizzle-orm/pg-core").PgBooleanBuilder
            >
         >,
         {
            name: string;
            tableName: "contact_subscriptions";
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
      canceledAt: import("drizzle-orm/pg-core").PgBuildColumn<
         "contact_subscriptions",
         import("drizzle-orm/pg-core").PgTimestampBuilder,
         {
            name: string;
            tableName: "contact_subscriptions";
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
         "contact_subscriptions",
         import("drizzle-orm/pg-core").SetHasDefault<
            import("drizzle-orm/pg-core").SetNotNull<
               import("drizzle-orm/pg-core").PgTimestampBuilder
            >
         >,
         {
            name: string;
            tableName: "contact_subscriptions";
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
         "contact_subscriptions",
         import("drizzle-orm/pg-core").SetHasDefault<
            import("drizzle-orm/pg-core").SetHasDefault<
               import("drizzle-orm/pg-core").SetNotNull<
                  import("drizzle-orm/pg-core").PgTimestampBuilder
               >
            >
         >,
         {
            name: string;
            tableName: "contact_subscriptions";
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
export type ContactSubscription = typeof contactSubscriptions.$inferSelect;
export type NewContactSubscription = typeof contactSubscriptions.$inferInsert;
export declare const createSubscriptionSchema: z.ZodObject<
   {
      status: z.ZodOptional<
         z.ZodEnum<{
            active: "active";
            cancelled: "cancelled";
            completed: "completed";
         }>
      >;
      source: z.ZodOptional<
         z.ZodEnum<{
            asaas: "asaas";
            manual: "manual";
         }>
      >;
      contactId: z.ZodString;
      variantId: z.ZodString;
      startDate: z.ZodString;
      endDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
      negotiatedPrice: z.ZodString;
      notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
      externalId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
      currentPeriodStart: z.ZodOptional<z.ZodNullable<z.ZodString>>;
      currentPeriodEnd: z.ZodOptional<z.ZodNullable<z.ZodString>>;
      cancelAtPeriodEnd: z.ZodDefault<z.ZodBoolean>;
   },
   {
      out: {};
      in: {};
   }
>;
export declare const updateSubscriptionSchema: z.ZodObject<
   {
      contactId: z.ZodOptional<z.ZodUUID>;
      variantId: z.ZodOptional<z.ZodUUID>;
      status: z.ZodOptional<
         z.ZodOptional<
            z.ZodEnum<{
               active: "active";
               cancelled: "cancelled";
               completed: "completed";
            }>
         >
      >;
      source: z.ZodOptional<
         z.ZodOptional<
            z.ZodEnum<{
               asaas: "asaas";
               manual: "manual";
            }>
         >
      >;
      startDate: z.ZodOptional<z.ZodOptional<z.ZodString>>;
      endDate: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
      negotiatedPrice: z.ZodOptional<z.ZodOptional<z.ZodString>>;
      notes: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
      externalId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
      currentPeriodStart: z.ZodOptional<
         z.ZodOptional<z.ZodNullable<z.ZodString>>
      >;
      currentPeriodEnd: z.ZodOptional<
         z.ZodOptional<z.ZodNullable<z.ZodString>>
      >;
      cancelAtPeriodEnd: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
   },
   {
      out: {};
      in: {};
   }
>;
export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;
//# sourceMappingURL=subscriptions.d.ts.map
