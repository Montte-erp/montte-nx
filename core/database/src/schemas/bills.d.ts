import { z } from "zod";
export declare const billTypeEnum: import("drizzle-orm/pg-core").PgEnum<
   ["payable", "receivable"]
>;
export declare const billStatusEnum: import("drizzle-orm/pg-core").PgEnum<
   ["pending", "paid", "cancelled"]
>;
export declare const recurrenceFrequencyEnum: import("drizzle-orm/pg-core").PgEnum<
   ["daily", "weekly", "biweekly", "monthly", "quarterly", "yearly"]
>;
export declare const recurrenceSettings: import("drizzle-orm/pg-core").PgTableWithColumns<{
   name: "recurrence_settings";
   schema: undefined;
   columns: {
      id: import("drizzle-orm/pg-core").PgBuildColumn<
         "recurrence_settings",
         import("drizzle-orm/pg-core").SetIsPrimaryKey<
            import("drizzle-orm/pg-core").SetHasDefault<
               import("drizzle-orm/pg-core").PgUUIDBuilder
            >
         >,
         {
            name: string;
            tableName: "recurrence_settings";
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
         "recurrence_settings",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgUUIDBuilder
         >,
         {
            name: string;
            tableName: "recurrence_settings";
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
      frequency: import("drizzle-orm/pg-core").PgBuildColumn<
         "recurrence_settings",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgEnumColumnBuilder<
               ["daily", "weekly", "biweekly", "monthly", "quarterly", "yearly"]
            >
         >,
         {
            name: string;
            tableName: "recurrence_settings";
            dataType: "string enum";
            data:
               | "biweekly"
               | "daily"
               | "monthly"
               | "quarterly"
               | "weekly"
               | "yearly";
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [
               "daily",
               "weekly",
               "biweekly",
               "monthly",
               "quarterly",
               "yearly",
            ];
            identity: undefined;
            generated: undefined;
         }
      >;
      windowMonths: import("drizzle-orm/pg-core").PgBuildColumn<
         "recurrence_settings",
         import("drizzle-orm/pg-core").SetHasDefault<
            import("drizzle-orm/pg-core").SetNotNull<
               import("drizzle-orm/pg-core").PgIntegerBuilder
            >
         >,
         {
            name: string;
            tableName: "recurrence_settings";
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
      endsAt: import("drizzle-orm/pg-core").PgBuildColumn<
         "recurrence_settings",
         import("drizzle-orm/pg-core").PgDateStringBuilder,
         {
            name: string;
            tableName: "recurrence_settings";
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
      createdAt: import("drizzle-orm/pg-core").PgBuildColumn<
         "recurrence_settings",
         import("drizzle-orm/pg-core").SetHasDefault<
            import("drizzle-orm/pg-core").SetNotNull<
               import("drizzle-orm/pg-core").PgTimestampBuilder
            >
         >,
         {
            name: string;
            tableName: "recurrence_settings";
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
         "recurrence_settings",
         import("drizzle-orm/pg-core").SetHasDefault<
            import("drizzle-orm/pg-core").SetHasDefault<
               import("drizzle-orm/pg-core").SetNotNull<
                  import("drizzle-orm/pg-core").PgTimestampBuilder
               >
            >
         >,
         {
            name: string;
            tableName: "recurrence_settings";
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
export declare const bills: import("drizzle-orm/pg-core").PgTableWithColumns<{
   name: "bills";
   schema: undefined;
   columns: {
      id: import("drizzle-orm/pg-core").PgBuildColumn<
         "bills",
         import("drizzle-orm/pg-core").SetIsPrimaryKey<
            import("drizzle-orm/pg-core").SetHasDefault<
               import("drizzle-orm/pg-core").PgUUIDBuilder
            >
         >,
         {
            name: string;
            tableName: "bills";
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
         "bills",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgUUIDBuilder
         >,
         {
            name: string;
            tableName: "bills";
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
         "bills",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>
         >,
         {
            name: string;
            tableName: "bills";
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
         "bills",
         import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>,
         {
            name: string;
            tableName: "bills";
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
         "bills",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgEnumColumnBuilder<
               ["payable", "receivable"]
            >
         >,
         {
            name: string;
            tableName: "bills";
            dataType: "string enum";
            data: "payable" | "receivable";
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: ["payable", "receivable"];
            identity: undefined;
            generated: undefined;
         }
      >;
      status: import("drizzle-orm/pg-core").PgBuildColumn<
         "bills",
         import("drizzle-orm/pg-core").SetHasDefault<
            import("drizzle-orm/pg-core").SetNotNull<
               import("drizzle-orm/pg-core").PgEnumColumnBuilder<
                  ["pending", "paid", "cancelled"]
               >
            >
         >,
         {
            name: string;
            tableName: "bills";
            dataType: "string enum";
            data: "cancelled" | "paid" | "pending";
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: ["pending", "paid", "cancelled"];
            identity: undefined;
            generated: undefined;
         }
      >;
      amount: import("drizzle-orm/pg-core").PgBuildColumn<
         "bills",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgNumericBuilder
         >,
         {
            name: string;
            tableName: "bills";
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
      dueDate: import("drizzle-orm/pg-core").PgBuildColumn<
         "bills",
         import("drizzle-orm/pg-core").SetNotNull<
            import("drizzle-orm/pg-core").PgDateStringBuilder
         >,
         {
            name: string;
            tableName: "bills";
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
      paidAt: import("drizzle-orm/pg-core").PgBuildColumn<
         "bills",
         import("drizzle-orm/pg-core").PgTimestampBuilder,
         {
            name: string;
            tableName: "bills";
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
      bankAccountId: import("drizzle-orm/pg-core").PgBuildColumn<
         "bills",
         import("drizzle-orm/pg-core").PgUUIDBuilder,
         {
            name: string;
            tableName: "bills";
            dataType: "string uuid";
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
      categoryId: import("drizzle-orm/pg-core").PgBuildColumn<
         "bills",
         import("drizzle-orm/pg-core").PgUUIDBuilder,
         {
            name: string;
            tableName: "bills";
            dataType: "string uuid";
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
      attachmentUrl: import("drizzle-orm/pg-core").PgBuildColumn<
         "bills",
         import("drizzle-orm/pg-core").PgTextBuilder<[string, ...string[]]>,
         {
            name: string;
            tableName: "bills";
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
      installmentGroupId: import("drizzle-orm/pg-core").PgBuildColumn<
         "bills",
         import("drizzle-orm/pg-core").PgUUIDBuilder,
         {
            name: string;
            tableName: "bills";
            dataType: "string uuid";
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
      installmentIndex: import("drizzle-orm/pg-core").PgBuildColumn<
         "bills",
         import("drizzle-orm/pg-core").PgIntegerBuilder,
         {
            name: string;
            tableName: "bills";
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
      installmentTotal: import("drizzle-orm/pg-core").PgBuildColumn<
         "bills",
         import("drizzle-orm/pg-core").PgIntegerBuilder,
         {
            name: string;
            tableName: "bills";
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
      recurrenceGroupId: import("drizzle-orm/pg-core").PgBuildColumn<
         "bills",
         import("drizzle-orm/pg-core").PgUUIDBuilder,
         {
            name: string;
            tableName: "bills";
            dataType: "string uuid";
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
      transactionId: import("drizzle-orm/pg-core").PgBuildColumn<
         "bills",
         import("drizzle-orm/pg-core").PgUUIDBuilder,
         {
            name: string;
            tableName: "bills";
            dataType: "string uuid";
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
      contactId: import("drizzle-orm/pg-core").PgBuildColumn<
         "bills",
         import("drizzle-orm/pg-core").PgUUIDBuilder,
         {
            name: string;
            tableName: "bills";
            dataType: "string uuid";
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
      subscriptionId: import("drizzle-orm/pg-core").PgBuildColumn<
         "bills",
         import("drizzle-orm/pg-core").PgUUIDBuilder,
         {
            name: string;
            tableName: "bills";
            dataType: "string uuid";
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
      createdAt: import("drizzle-orm/pg-core").PgBuildColumn<
         "bills",
         import("drizzle-orm/pg-core").SetHasDefault<
            import("drizzle-orm/pg-core").SetNotNull<
               import("drizzle-orm/pg-core").PgTimestampBuilder
            >
         >,
         {
            name: string;
            tableName: "bills";
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
         "bills",
         import("drizzle-orm/pg-core").SetHasDefault<
            import("drizzle-orm/pg-core").SetHasDefault<
               import("drizzle-orm/pg-core").SetNotNull<
                  import("drizzle-orm/pg-core").PgTimestampBuilder
               >
            >
         >,
         {
            name: string;
            tableName: "bills";
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
export type Bill = typeof bills.$inferSelect;
export type NewBill = typeof bills.$inferInsert;
export type BillType = (typeof billTypeEnum.enumValues)[number];
export type BillStatus = (typeof billStatusEnum.enumValues)[number];
export type RecurrenceFrequency =
   (typeof recurrenceFrequencyEnum.enumValues)[number];
export type RecurrenceSetting = typeof recurrenceSettings.$inferSelect;
export type NewRecurrenceSetting = typeof recurrenceSettings.$inferInsert;
export declare const createBillSchema: z.ZodObject<
   {
      name: z.ZodString;
      description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
      type: z.ZodEnum<{
         payable: "payable";
         receivable: "receivable";
      }>;
      amount: z.ZodString;
      dueDate: z.ZodString;
      bankAccountId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
      categoryId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
      contactId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
      attachmentUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
   },
   {
      out: {};
      in: {};
   }
>;
export declare const updateBillSchema: z.ZodObject<
   {
      name: z.ZodOptional<z.ZodString>;
      description: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
      type: z.ZodOptional<
         z.ZodEnum<{
            payable: "payable";
            receivable: "receivable";
         }>
      >;
      amount: z.ZodOptional<z.ZodString>;
      dueDate: z.ZodOptional<z.ZodString>;
      bankAccountId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
      categoryId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
      contactId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
      attachmentUrl: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
      status: z.ZodOptional<
         z.ZodOptional<
            z.ZodEnum<{
               cancelled: "cancelled";
               paid: "paid";
               pending: "pending";
            }>
         >
      >;
      paidAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodDate>>>;
      transactionId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
   },
   {
      out: {};
      in: {};
   }
>;
export declare const createRecurrenceSettingSchema: z.ZodObject<
   {
      frequency: z.ZodEnum<{
         biweekly: "biweekly";
         daily: "daily";
         monthly: "monthly";
         quarterly: "quarterly";
         weekly: "weekly";
         yearly: "yearly";
      }>;
      windowMonths: z.ZodDefault<z.ZodNumber>;
      endsAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
   },
   {
      out: {};
      in: {};
   }
>;
export type CreateBillInput = z.infer<typeof createBillSchema>;
export type UpdateBillInput = z.infer<typeof updateBillSchema>;
export type CreateRecurrenceSettingInput = z.infer<
   typeof createRecurrenceSettingSchema
>;
//# sourceMappingURL=bills.d.ts.map
